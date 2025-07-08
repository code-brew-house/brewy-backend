import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { JwtPayload } from '../types/auth.types';
import { JwtValidationService } from '../services/jwt-validation.service';
import { SecurityLoggerService } from '../../../common/services/security-logger.service';

/**
 * JWT strategy for validating JWT tokens and extracting user information
 * Enhanced with comprehensive token validation
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly jwtValidationService: JwtValidationService,
    private readonly securityLogger: SecurityLoggerService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'fallback-secret-key',
      passReqToCallback: true, // Enable request object in validate method
    });
  }

  /**
   * Validates JWT payload and returns user information
   * Enhanced with comprehensive validation and security checks
   * @param req - Express request object (when passReqToCallback is true)
   * @param payload - JWT payload containing user information
   * @returns User object if valid, throws UnauthorizedException if invalid
   */
  async validate(req: any, payload: JwtPayload) {
    try {
      // Perform enhanced token validation
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token =
          this.jwtValidationService.extractTokenFromHeader(authHeader);

        // Check if token is expiring soon and log warning
        const isExpiringSoon =
          await this.jwtValidationService.isTokenExpiringSoon(token, 30);
        if (isExpiringSoon) {
          console.warn(
            `[JWT STRATEGY] Token expiring soon for user: ${payload.sub}`,
          );
        }
      }

      // Find user by ID from JWT payload
      const user = await this.userService.findById(payload.sub);

      if (!user) {
        console.error(`[JWT STRATEGY] User not found for ID: ${payload.sub}`);
        throw new UnauthorizedException('Invalid token - user not found');
      }

      // Additional security checks
      if (user.email !== payload.email) {
        console.error(`[JWT STRATEGY] Email mismatch for user: ${payload.sub}`);

        this.securityLogger.logTokenValidationFailure(
          'Token email mismatch',
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          req.path || 'unknown',
          req.method || 'unknown',
        );

        throw new UnauthorizedException('Token email mismatch');
      }

      if (user.username !== payload.username) {
        console.error(
          `[JWT STRATEGY] Username mismatch for user: ${payload.sub}`,
        );

        this.securityLogger.logTokenValidationFailure(
          'Token username mismatch',
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          req.path || 'unknown',
          req.method || 'unknown',
        );

        throw new UnauthorizedException('Token username mismatch');
      }

      console.log(
        `[JWT STRATEGY] Successfully validated token for user: ${user.id}`,
      );

      // Log successful token validation
      this.securityLogger.logTokenValidationSuccess(
        user.id,
        user.username,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        req.path || 'unknown',
        req.method || 'unknown',
      );

      // Return user object that will be attached to request.user
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
      };
    } catch (error) {
      console.error(`[JWT STRATEGY] Token validation failed: ${error.message}`);

      // Log failed validation attempts for security monitoring
      this.securityLogger.logTokenValidationFailure(
        error.message || 'Unknown token validation error',
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        req.path || 'unknown',
        req.method || 'unknown',
        req.headers?.authorization,
      );

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid token');
    }
  }
}
