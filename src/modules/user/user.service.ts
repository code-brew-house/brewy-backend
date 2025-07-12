import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ICreateUser, UserRole, IUser } from './types/user.types';
import { UserResponseDto } from './dto/user-response.dto';
import { PasswordUtil } from '../../common/utils/password.util';
import {
  OrganizationNotFoundForLimitException,
  UserLimitExceededException,
} from '../organization/exceptions/organization-limits.exception';
import { ORGANIZATION_LIMITS } from '../organization/constants/organization.constants';

/**
 * UserService handles business logic for user management operations.
 */
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new user with organization context and role validation.
   * Enforces role creation rules: ADMIN can only create AGENT users.
   */
  async create(
    createUserData: ICreateUser,
    creatorRole?: UserRole,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _creatorId?: string,
  ): Promise<UserResponseDto> {
    try {
      // Validate organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: createUserData.organizationId },
      });
      if (!organization) {
        throw new BadRequestException('Organization not found');
      }

      // Validate user limit for organization
      await this.validateUserLimit(createUserData.organizationId);

      // Enforce role creation rules
      if (creatorRole && creatorRole !== 'SUPER_OWNER') {
        this.validateRoleCreation(creatorRole, createUserData.role);
      }

      // Check for duplicate email within organization
      const existingEmail = await this.prisma.user.findFirst({
        where: {
          email: createUserData.email,
          organizationId: createUserData.organizationId,
        },
      });
      if (existingEmail) {
        console.error(
          `[CREATE ERROR] Email already exists in organization: ${createUserData.email}`,
        );
        throw new ConflictException(
          'Email already exists in this organization',
        );
      }

      // Check for duplicate username globally
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: createUserData.username },
      });
      if (existingUsername) {
        console.error(
          `[CREATE ERROR] Username already exists: ${createUserData.username}`,
        );
        throw new ConflictException('Username already exists');
      }

      // Hash password before storing
      const hashedPassword = await PasswordUtil.hashPassword(
        createUserData.password,
      );

      // Create user with organization context
      const user = await this.prisma.user.create({
        data: {
          username: createUserData.username,
          email: createUserData.email,
          password: hashedPassword,
          fullName: createUserData.fullName,
          organizationId: createUserData.organizationId,
          role: createUserData.role,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Increment organization member count
      await this.prisma.organization.update({
        where: { id: createUserData.organizationId },
        data: {
          totalMemberCount: {
            increment: 1,
          },
        },
      });

      console.log(
        `[CREATE SUCCESS] User created: ${user.id} in organization: ${user.organizationId}`,
      );

      // Manually exclude password field
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;
      return new UserResponseDto(userWithoutPassword);
    } catch (error) {
      console.error(`[CREATE ERROR] Failed to create user: ${error.message}`);
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create user: ' + error.message,
      );
    }
  }

  /**
   * Validates role creation permissions based on creator's role.
   */
  private validateRoleCreation(
    creatorRole: UserRole,
    targetRole: UserRole,
  ): void {
    const roleHierarchy: Record<UserRole, UserRole[]> = {
      SUPER_OWNER: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'AGENT'],
      OWNER: ['ADMIN', 'AGENT'],
      ADMIN: ['AGENT'],
      AGENT: [],
    };

    const allowedRoles = roleHierarchy[creatorRole] || [];

    if (!allowedRoles.includes(targetRole)) {
      throw new ForbiddenException(
        `${creatorRole} cannot create users with role ${targetRole}`,
      );
    }
  }

  /**
   * Validates that the organization has not exceeded its user limit.
   */
  private async validateUserLimit(organizationId: string): Promise<void> {
    try {
      // Get organization with current member count and limits
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          totalMemberCount: true,
          maxUsers: true,
        },
      });

      if (!organization) {
        throw new OrganizationNotFoundForLimitException(organizationId);
      }

      // Check if adding one more user would exceed the limit
      const currentCount = organization.totalMemberCount;
      const maxUsers =
        organization.maxUsers || ORGANIZATION_LIMITS.DEFAULT_MAX_USERS;

      if (currentCount >= maxUsers) {
        throw new UserLimitExceededException(
          organizationId,
          currentCount,
          maxUsers,
        );
      }

      console.log(
        `[USER_LIMIT_CHECK] Organization ${organizationId}: ${currentCount}/${maxUsers} users`,
      );
    } catch (error) {
      console.error(
        `[USER_LIMIT_ERROR] Failed to validate user limit: ${error.message}`,
      );
      if (
        error instanceof UserLimitExceededException ||
        error instanceof OrganizationNotFoundForLimitException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to validate user limit: ' + error.message,
      );
    }
  }

  /**
   * Finds a user by email address.
   */
  async findByEmail(email: string): Promise<IUser | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        console.log(`[FIND SUCCESS] User found by email: ${email}`);
      } else {
        console.log(`[FIND INFO] User not found by email: ${email}`);
      }

      return user;
    } catch (error) {
      console.error(
        `[FIND ERROR] Failed to find user by email: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to find user by email: ' + error.message,
      );
    }
  }

  /**
   * Finds a user by username.
   */
  async findByUsername(username: string): Promise<IUser | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
      });

      if (user) {
        console.log(`[FIND SUCCESS] User found by username: ${username}`);
      } else {
        console.log(`[FIND INFO] User not found by username: ${username}`);
      }

      return user;
    } catch (error) {
      console.error(
        `[FIND ERROR] Failed to find user by username: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to find user by username: ' + error.message,
      );
    }
  }

  /**
   * Finds a user by ID.
   */
  async findById(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        console.error(`[FIND ERROR] User not found: ${id}`);
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      console.log(`[FIND SUCCESS] User retrieved: ${id}`);
      // Manually exclude password field
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;
      return new UserResponseDto(userWithoutPassword);
    } catch (error) {
      console.error(`[FIND ERROR] Failed to find user by ID: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to find user by ID: ' + error.message,
      );
    }
  }

  /**
   * Updates a user's information.
   */
  async update(
    id: string,
    updateData: Partial<ICreateUser>,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
      });

      console.log(`[UPDATE SUCCESS] User updated: ${id}`);
      // Manually exclude password field
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;
      return new UserResponseDto(userWithoutPassword);
    } catch (error) {
      if (error.code === 'P2025') {
        console.error(`[UPDATE ERROR] User not found: ${id}`);
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      console.error(`[UPDATE ERROR] Failed to update user: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to update user: ' + error.message,
      );
    }
  }

  /**
   * Validates a user's password for authentication.
   */
  async validatePassword(user: IUser, password: string): Promise<boolean> {
    try {
      const isValid = await PasswordUtil.comparePassword(
        password,
        user.password,
      );
      console.log(
        `[VALIDATE SUCCESS] Password validation for user: ${user.id}`,
      );
      return isValid;
    } catch (error) {
      console.error(
        `[VALIDATE ERROR] Failed to validate password: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to validate password: ' + error.message,
      );
    }
  }

  /**
   * Deletes a user by ID with organization context validation.
   */
  async delete(id: string): Promise<void> {
    try {
      // First get the user to check organization and role
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Prevent deletion of last OWNER in organization
      if (user.role === 'OWNER') {
        const ownerCount = await this.prisma.user.count({
          where: {
            organizationId: user.organizationId,
            role: 'OWNER',
          },
        });

        if (ownerCount <= 1) {
          throw new ForbiddenException(
            'Cannot delete the last OWNER in the organization',
          );
        }
      }

      // Delete user
      await this.prisma.user.delete({
        where: { id },
      });

      // Decrement organization member count
      await this.prisma.organization.update({
        where: { id: user.organizationId },
        data: {
          totalMemberCount: {
            decrement: 1,
          },
        },
      });

      console.log(`[DELETE SUCCESS] User deleted: ${id}`);
    } catch (error) {
      if (error.code === 'P2025') {
        console.error(`[DELETE ERROR] User not found: ${id}`);
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      console.error(`[DELETE ERROR] Failed to delete user: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to delete user: ' + error.message,
      );
    }
  }

  /**
   * Finds all users within a specific organization.
   */
  async findByOrganization(organizationId: string): Promise<UserResponseDto[]> {
    try {
      const users = await this.prisma.user.findMany({
        where: { organizationId },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      console.log(
        `[FIND SUCCESS] Found ${users.length} users in organization: ${organizationId}`,
      );

      return users.map((user) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = user;
        return new UserResponseDto(userWithoutPassword);
      });
    } catch (error) {
      console.error(
        `[FIND ERROR] Failed to find users by organization: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to find users by organization: ' + error.message,
      );
    }
  }

  /**
   * Validates if a user has access to a specific organization.
   */
  async validateOrganizationAccess(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true, role: true },
      });

      if (!user) {
        return false;
      }

      // SUPER_OWNER can access any organization
      if (user.role === 'SUPER_OWNER') {
        return true;
      }

      // Others can only access their own organization
      return user.organizationId === organizationId;
    } catch (error) {
      console.error(
        `[VALIDATE ERROR] Failed to validate organization access: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Counts the number of users in an organization.
   */
  async countByOrganization(organizationId: string): Promise<number> {
    try {
      const count = await this.prisma.user.count({
        where: { organizationId },
      });

      console.log(
        `[COUNT SUCCESS] Found ${count} users in organization: ${organizationId}`,
      );
      return count;
    } catch (error) {
      console.error(
        `[COUNT ERROR] Failed to count users by organization: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to count users by organization: ' + error.message,
      );
    }
  }

  /**
   * Finds all users with filtering based on user role and organization context.
   * SUPER_OWNER can see all users across all organizations.
   * Others can only see users within their organization.
   */
  async findAll(
    requestingUserId: string,
    filters?: {
      organizationId?: string;
      role?: UserRole;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ users: UserResponseDto[]; total: number }> {
    try {
      // Get requesting user's context
      const requestingUser = await this.prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { organizationId: true, role: true },
      });

      if (!requestingUser) {
        throw new NotFoundException('Requesting user not found');
      }

      // Build where clause based on user role
      const whereClause: any = {};

      // SUPER_OWNER can see all users, others only within their organization
      if (requestingUser.role !== 'SUPER_OWNER') {
        whereClause.organizationId = requestingUser.organizationId;
      }

      // Apply additional filters
      if (filters?.organizationId && requestingUser.role === 'SUPER_OWNER') {
        whereClause.organizationId = filters.organizationId;
      }

      if (filters?.role) {
        whereClause.role = filters.role;
      }

      // Search functionality (username, email, fullName)
      if (filters?.search) {
        whereClause.OR = [
          { username: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { fullName: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // Get total count for pagination
      const total = await this.prisma.user.count({
        where: whereClause,
      });

      // Get users with pagination
      const users = await this.prisma.user.findMany({
        where: whereClause,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' }, // Sort by role hierarchy
          { createdAt: 'desc' },
        ],
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      });

      console.log(
        `[FIND_ALL SUCCESS] Found ${users.length}/${total} users for user: ${requestingUserId}`,
      );

      const userDtos = users.map((user) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = user;
        return new UserResponseDto(userWithoutPassword);
      });

      return {
        users: userDtos,
        total,
      };
    } catch (error) {
      console.error(`[FIND_ALL ERROR] Failed to find users: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to find users: ' + error.message,
      );
    }
  }

  /**
   * Finds users within a specific organization with role-based filtering.
   * Used by organization owners/admins to manage their team.
   */
  async findByOrganizationWithRoleFilter(
    organizationId: string,
    requestingUserRole: UserRole,
    filters?: {
      role?: UserRole;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ users: UserResponseDto[]; total: number }> {
    try {
      const whereClause: any = {
        organizationId,
      };

      // Role-based filtering
      if (filters?.role) {
        whereClause.role = filters.role;
      }

      // Search functionality
      if (filters?.search) {
        whereClause.OR = [
          { username: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { fullName: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // Role hierarchy restrictions
      // ADMIN can only see AGENT users, OWNER can see ADMIN and AGENT
      if (requestingUserRole === 'ADMIN') {
        whereClause.role = 'AGENT';
      } else if (requestingUserRole === 'OWNER') {
        whereClause.role = { in: ['ADMIN', 'AGENT'] };
      }
      // SUPER_OWNER can see all roles (no additional restriction)

      const total = await this.prisma.user.count({
        where: whereClause,
      });

      const users = await this.prisma.user.findMany({
        where: whereClause,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      });

      console.log(
        `[FIND_BY_ORG SUCCESS] Found ${users.length}/${total} users in organization: ${organizationId}`,
      );

      const userDtos = users.map((user) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = user;
        return new UserResponseDto(userWithoutPassword);
      });

      return {
        users: userDtos,
        total,
      };
    } catch (error) {
      console.error(
        `[FIND_BY_ORG ERROR] Failed to find users by organization: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to find users by organization: ' + error.message,
      );
    }
  }
}
