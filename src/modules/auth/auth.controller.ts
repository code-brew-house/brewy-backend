import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtValidationService } from './services/jwt-validation.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * AuthController handles HTTP endpoints for authentication operations.
 * Provides endpoints for user registration, login, and logout.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtValidationService: JwtValidationService,
  ) {}

  /**
   * Register a new user
   * Rate limited to 3 attempts per 10 minutes per IP
   * @param registerDto - User registration data
   * @returns Authentication response with token and user data
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ register: { limit: 3, ttl: 600000 } })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  )
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: any,
  ): Promise<AuthResponseDto> {
    try {
      return await this.authService.register(
        registerDto,
        req.ip,
        req.get('User-Agent'),
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        // Generic error message for security (don't reveal specific conflicts)
        throw new ConflictException(
          'Registration failed - user may already exist',
        );
      }
      throw new InternalServerErrorException('Registration failed');
    }
  }

  /**
   * Login with email/username and password
   * Rate limited to 5 attempts per 15 minutes per IP
   * @param loginDto - Login credentials
   * @returns Authentication response with token and user data
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 900000 } })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  )
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: any,
  ): Promise<AuthResponseDto> {
    try {
      return await this.authService.login(
        loginDto,
        req.ip,
        req.get('User-Agent'),
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        // Generic error message for security (don't reveal if user exists or not)
        throw new UnauthorizedException('Invalid credentials');
      }
      throw new InternalServerErrorException('Login failed');
    }
  }

  /**
   * Logout current user
   * @param req - Request object containing authenticated user
   * @returns Success response
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: any): Promise<{ message: string }> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      await this.authService.logout(userId);

      return { message: 'Logout successful' };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Logout failed');
    }
  }

  /**
   * Validate token and return token status information
   * @param authorization - Authorization header containing JWT token
   * @returns Token validation status and metadata
   */
  @Get('validate-token')
  @HttpCode(HttpStatus.OK)
  async validateToken(
    @Headers('authorization') authorization: string,
  ): Promise<{
    valid: boolean;
    expiresAt?: string;
    issuedAt?: string;
    expiringSoon?: boolean;
    user?: { id: string; username: string; email: string };
  }> {
    try {
      if (!authorization) {
        return { valid: false };
      }

      const token =
        this.jwtValidationService.extractTokenFromHeader(authorization);
      const payload = await this.jwtValidationService.validateToken(token);

      const expiresAt =
        await this.jwtValidationService.getTokenExpiration(token);
      const issuedAt = await this.jwtValidationService.getTokenIssuedAt(token);
      const expiringSoon = await this.jwtValidationService.isTokenExpiringSoon(
        token,
        30,
      );

      return {
        valid: true,
        expiresAt: expiresAt.toISOString(),
        issuedAt: issuedAt.toISOString(),
        expiringSoon,
        user: {
          id: payload.sub,
          username: payload.username,
          email: payload.email,
        },
      };
    } catch (error) {
      console.error(
        `[AUTH VALIDATE] Token validation failed: ${error.message}`,
      );
      return { valid: false };
    }
  }
}
