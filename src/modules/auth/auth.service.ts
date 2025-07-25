import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './types/auth.types';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityLoggerService } from '../../common/services/security-logger.service';
import { UserRole } from '../user/types/user.types';

/**
 * AuthService handles authentication operations including
 * user registration, login, logout, and JWT token management.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly securityLogger: SecurityLoggerService,
  ) {}

  /**
   * Registers a new user with validation and creates JWT token
   * @param registerDto - User registration data
   * @param ipAddress - Client IP address for security logging
   * @param userAgent - Client user agent for security logging
   * @returns Authentication response with token and user data
   */
  async register(
    registerDto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    try {
      console.log(
        `[AUTH REGISTER] Attempting to register user: ${registerDto.email}`,
      );

      // Determine if this is the first user (Super Owner) registration
      const existingSuperOwners = await this.prismaService.user.count({
        where: { role: 'SUPER_OWNER' },
      });

      let organizationId: string;
      let userRole: UserRole;

      if (existingSuperOwners === 0) {
        // First Super Owner registration - create default organization
        console.log(
          '[AUTH REGISTER] First Super Owner registration, creating default organization',
        );

        const organizationData = {
          name: registerDto.organizationName || 'Default Organization',
          contactNumber:
            registerDto.organizationContactNumber || '000-000-0000',
          email: registerDto.organizationEmail || registerDto.email,
        };

        const organization = await this.prismaService.organization.create({
          data: organizationData,
        });

        organizationId = organization.id;
        userRole = 'SUPER_OWNER';

        console.log(
          `[AUTH REGISTER] Created default organization: ${organization.id}`,
        );
      } else {
        // Subsequent registrations require existing organization
        // For now, we'll throw an error as regular registration should go through invite flow
        throw new BadRequestException(
          'Regular user registration should be done through organization invitation',
        );
      }

      // Create user through UserService (handles validation and duplicate checking)
      const user = await this.userService.create({
        username: registerDto.username,
        email: registerDto.email,
        password: registerDto.password,
        fullName: registerDto.fullName,
        organizationId: organizationId,
        role: userRole,
      });

      // Generate JWT token with organization context
      const payload: JwtPayload = {
        sub: user.id,
        username: user.username,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
      };

      const accessToken = await this.jwtService.signAsync(payload);
      const expiresIn = this.getTokenExpirationTime();

      console.log(`[AUTH REGISTER] Successfully registered user: ${user.id}`);

      // Log successful registration
      this.securityLogger.logSuccessfulRegistration(
        user.id,
        user.username,
        user.email,
        ipAddress || 'unknown',
        userAgent || 'unknown',
      );

      return new AuthResponseDto(
        'User registered successfully',
        user,
        accessToken,
        expiresIn,
      );
    } catch (error) {
      console.error(`[AUTH REGISTER] Registration failed: ${error.message}`);

      // Log failed registration
      this.securityLogger.logFailedRegistration(
        registerDto.email,
        registerDto.username,
        ipAddress || 'unknown',
        userAgent || 'unknown',
        error.message,
      );

      if (error instanceof ConflictException) {
        throw error; // Re-throw validation errors from UserService
      }

      throw new InternalServerErrorException(
        'Registration failed: ' + error.message,
      );
    }
  }

  /**
   * Authenticates a user with email/username and password
   * @param loginDto - Login credentials
   * @param ipAddress - Client IP address for security logging
   * @param userAgent - Client user agent for security logging
   * @returns Authentication response with token and user data
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    try {
      console.log(`[AUTH LOGIN] Attempting login for: ${loginDto.identifier}`);

      // Find user by email or username
      let user = await this.userService.findByEmail(loginDto.identifier);
      if (!user) {
        user = await this.userService.findByUsername(loginDto.identifier);
      }

      if (!user) {
        console.error(`[AUTH LOGIN] User not found: ${loginDto.identifier}`);

        // Log failed login attempt
        this.securityLogger.logFailedLogin(
          loginDto.identifier,
          ipAddress || 'unknown',
          userAgent || 'unknown',
          'User not found',
        );

        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if account is locked
      if (await this.isAccountLocked(user)) {
        console.error(`[AUTH LOGIN] Account locked for user: ${user.id}`);

        // Log account locked attempt
        const lockoutDuration = this.configService.get<number>(
          'LOCKOUT_DURATION_MINUTES',
          15,
        );
        this.securityLogger.logAccountLocked(
          user.id,
          user.username,
          ipAddress || 'unknown',
          lockoutDuration,
        );

        throw new UnauthorizedException(
          'Account is temporarily locked due to too many failed attempts',
        );
      }

      // Validate password
      const isPasswordValid = await this.userService.validatePassword(
        user,
        loginDto.password,
      );

      if (!isPasswordValid) {
        console.error(`[AUTH LOGIN] Invalid password for user: ${user.id}`);

        // Log failed login attempt
        this.securityLogger.logFailedLogin(
          loginDto.identifier,
          ipAddress || 'unknown',
          userAgent || 'unknown',
          'Invalid password',
          { userId: user.id, username: user.username },
        );

        // Record failed login attempt
        await this.recordFailedLogin(user.id);

        throw new UnauthorizedException('Invalid credentials');
      }

      // Reset failed attempts on successful login
      await this.resetFailedAttempts(user.id);

      // Generate JWT token with organization context
      const payload: JwtPayload = {
        sub: user.id,
        username: user.username,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
      };

      const accessToken = await this.jwtService.signAsync(payload);
      const expiresIn = this.getTokenExpirationTime();

      console.log(`[AUTH LOGIN] Successfully authenticated user: ${user.id}`);

      // Log successful login
      this.securityLogger.logSuccessfulLogin(
        user.id,
        user.username,
        user.email,
        ipAddress || 'unknown',
        userAgent || 'unknown',
      );

      // Convert to UserResponseDto to exclude password
      const userResponse = new UserResponseDto(user);

      return new AuthResponseDto(
        'Login successful',
        userResponse,
        accessToken,
        expiresIn,
      );
    } catch (error) {
      console.error(`[AUTH LOGIN] Login failed: ${error.message}`);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException('Login failed: ' + error.message);
    }
  }

  /**
   * Logs out a user (for future token blacklisting implementation)
   * @param userId - ID of the user to log out
   */
  async logout(userId: string): Promise<void> {
    try {
      console.log(`[AUTH LOGOUT] Logging out user: ${userId}`);

      // For now, this is a placeholder
      // In a production system, you would:
      // 1. Add the token to a blacklist/revocation list
      // 2. Store revoked tokens in Redis or database
      // 3. Check blacklist in JWT strategy

      console.log(`[AUTH LOGOUT] User logged out successfully: ${userId}`);
    } catch (error) {
      console.error(`[AUTH LOGOUT] Logout failed: ${error.message}`);
      throw new InternalServerErrorException('Logout failed: ' + error.message);
    }
  }

  /**
   * Validates a user from JWT payload (used by JWT strategy)
   * @param payload - JWT payload
   * @returns User object if valid
   */
  async validateUser(payload: JwtPayload) {
    try {
      const user = await this.userService.findById(payload.sub);

      if (!user) {
        console.error(
          `[AUTH VALIDATE] User not found for token: ${payload.sub}`,
        );
        return null;
      }

      console.log(`[AUTH VALIDATE] Token validated for user: ${user.id}`);
      return user;
    } catch (error) {
      console.error(
        `[AUTH VALIDATE] Token validation failed: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Gets token expiration time in seconds
   * @returns Expiration time in seconds
   */
  private getTokenExpirationTime(): number {
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '24h');

    // Handle null/undefined values
    if (!expiresIn || typeof expiresIn !== 'string') {
      return 86400; // Default 24 hours
    }

    // Convert common time formats to seconds
    if (expiresIn.endsWith('h')) {
      return parseInt(expiresIn) * 3600;
    } else if (expiresIn.endsWith('m')) {
      return parseInt(expiresIn) * 60;
    } else if (expiresIn.endsWith('d')) {
      return parseInt(expiresIn) * 86400;
    }

    // Default to seconds if no unit specified
    return parseInt(expiresIn) || 86400; // Default 24 hours
  }

  /**
   * Checks if a user account is currently locked
   * @param user - User object with lockout fields
   * @returns True if account is locked, false otherwise
   */
  private async isAccountLocked(user: any): Promise<boolean> {
    const maxFailedAttempts = this.configService.get<number>(
      'MAX_FAILED_ATTEMPTS',
      5,
    );
    const lockoutDuration = this.configService.get<number>(
      'LOCKOUT_DURATION_MINUTES',
      15,
    );

    // Check if account has exceeded max failed attempts
    if (user.failedAttempts >= maxFailedAttempts) {
      // Check if lockout period has expired
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return true; // Still locked
      } else if (user.lockedUntil && user.lockedUntil <= new Date()) {
        // Lockout period has expired, reset the account
        await this.resetFailedAttempts(user.id);
        return false;
      } else {
        // No lockout timestamp set but max attempts exceeded, lock the account
        const lockUntil = new Date(Date.now() + lockoutDuration * 60 * 1000);
        await this.lockAccount(user.id, lockUntil);
        return true;
      }
    }

    return false;
  }

  /**
   * Records a failed login attempt and locks account if necessary
   * @param userId - ID of the user who failed login
   */
  private async recordFailedLogin(userId: string): Promise<void> {
    const maxFailedAttempts = this.configService.get<number>(
      'MAX_FAILED_ATTEMPTS',
      5,
    );
    const lockoutDuration = this.configService.get<number>(
      'LOCKOUT_DURATION_MINUTES',
      15,
    );

    try {
      // Increment failed attempts
      const updatedUser = await this.prismaService.user.update({
        where: { id: userId },
        data: {
          failedAttempts: { increment: 1 },
          lastFailedLogin: new Date(),
        },
      });

      // Lock account if max attempts reached
      if (updatedUser.failedAttempts >= maxFailedAttempts) {
        const lockUntil = new Date(Date.now() + lockoutDuration * 60 * 1000);
        await this.lockAccount(userId, lockUntil);

        console.log(
          `[AUTH LOCKOUT] Account locked for user: ${userId} until ${lockUntil.toISOString()}`,
        );
      }
    } catch (error) {
      console.error(
        `[AUTH LOCKOUT] Failed to record failed login: ${error.message}`,
      );
    }
  }

  /**
   * Locks a user account until specified time
   * @param userId - ID of the user to lock
   * @param lockUntil - When the lock should expire
   */
  private async lockAccount(userId: string, lockUntil: Date): Promise<void> {
    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        lockedUntil: lockUntil,
      },
    });
  }

  /**
   * Resets failed login attempts for a user
   * @param userId - ID of the user to reset
   */
  private async resetFailedAttempts(userId: string): Promise<void> {
    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastFailedLogin: null,
      },
    });
  }

  /**
   * Switch organization context for a user (SUPER_OWNER only)
   * Generates a new JWT token with the target organization context
   * @param userId - ID of the user switching organizations
   * @param targetOrganizationId - ID of the target organization
   * @returns New authentication response with updated token
   */
  async switchOrganization(
    userId: string,
    targetOrganizationId: string,
  ): Promise<AuthResponseDto> {
    try {
      console.log(
        `[AUTH SWITCH_ORG] User ${userId} switching to organization: ${targetOrganizationId}`,
      );

      // Get current user
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Only SUPER_OWNER can switch organizations
      if (user.role !== 'SUPER_OWNER') {
        throw new UnauthorizedException(
          'Only SUPER_OWNER can switch organizations',
        );
      }

      // Validate target organization exists
      const targetOrganization =
        await this.prismaService.organization.findUnique({
          where: { id: targetOrganizationId },
        });
      if (!targetOrganization) {
        throw new UnauthorizedException('Target organization not found');
      }

      // Generate new JWT token with target organization context
      const payload: JwtPayload = {
        sub: user.id,
        username: user.username,
        email: user.email,
        organizationId: targetOrganizationId, // Use target organization
        role: user.role,
      };

      const accessToken = await this.jwtService.signAsync(payload);
      const expiresIn = this.getTokenExpirationTime();

      console.log(
        `[AUTH SWITCH_ORG] Successfully switched user ${userId} to organization: ${targetOrganizationId}`,
      );

      // Log organization switch
      this.securityLogger.logSuccessfulLogin(
        user.id,
        user.username,
        user.email,
        'organization-switch',
        'system',
      );

      return new AuthResponseDto(
        'Organization switched successfully',
        user,
        accessToken,
        expiresIn,
      );
    } catch (error) {
      console.error(
        `[AUTH SWITCH_ORG] Organization switch failed: ${error.message}`,
      );

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Organization switch failed: ' + error.message,
      );
    }
  }

  /**
   * Get organizations that a user has access to
   * SUPER_OWNER can access all organizations
   * Other users can only access their own organization
   * @param userId - ID of the user
   * @returns List of accessible organizations
   */
  async getAccessibleOrganizations(userId: string): Promise<{
    organizations: Array<{
      id: string;
      name: string;
      email: string;
      isCurrent: boolean;
    }>;
  }> {
    try {
      console.log(
        `[AUTH GET_ORGS] Getting accessible organizations for user: ${userId}`,
      );

      // Get current user
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      let organizations: Array<{
        id: string;
        name: string;
        email: string;
        isCurrent: boolean;
      }> = [];

      if (user.role === 'SUPER_OWNER') {
        // SUPER_OWNER can access all organizations
        const allOrganizations = await this.prismaService.organization.findMany(
          {
            select: {
              id: true,
              name: true,
              email: true,
            },
            orderBy: {
              name: 'asc',
            },
          },
        );

        organizations = allOrganizations.map((org) => ({
          ...org,
          isCurrent: org.id === user.organizationId,
        }));
      } else {
        // Other users can only access their own organization
        const userOrganization =
          await this.prismaService.organization.findUnique({
            where: { id: user.organizationId },
            select: {
              id: true,
              name: true,
              email: true,
            },
          });

        if (userOrganization) {
          organizations = [
            {
              ...userOrganization,
              isCurrent: true,
            },
          ];
        }
      }

      console.log(
        `[AUTH GET_ORGS] Found ${organizations.length} accessible organizations for user: ${userId}`,
      );

      return { organizations };
    } catch (error) {
      console.error(
        `[AUTH GET_ORGS] Failed to get accessible organizations: ${error.message}`,
      );

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to get accessible organizations: ' + error.message,
      );
    }
  }
}
