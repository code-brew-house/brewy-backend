import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../types/auth.types';

/**
 * JWT Validation Service for enhanced token validation and management
 * Provides additional validation beyond basic passport-jwt functionality
 */
@Injectable()
export class JwtValidationService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
    this.jwtExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '24h';
  }

  /**
   * Validates a JWT token with comprehensive checks
   * @param token - JWT token to validate
   * @returns Decoded payload if valid
   * @throws UnauthorizedException if invalid
   */
  async validateToken(token: string): Promise<JwtPayload> {
    try {
      // Remove 'Bearer ' prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      // Verify and decode the token
      const decoded = await this.jwtService.verifyAsync(cleanToken, {
        secret: this.jwtSecret,
      });

      // Additional validation checks
      this.validateTokenStructure(decoded);
      this.validateTokenExpiration(decoded);
      this.validateTokenClaims(decoded);

      console.log(
        `[JWT VALIDATION] Token successfully validated for user: ${decoded.sub}`,
      );
      return decoded as JwtPayload;
    } catch (error) {
      console.error(
        `[JWT VALIDATION] Token validation failed: ${error.message}`,
      );

      if (error instanceof UnauthorizedException) {
        throw error; // Re-throw our custom validation errors
      } else if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token format');
      } else if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not yet valid');
      } else {
        throw new UnauthorizedException('Token validation failed');
      }
    }
  }

  /**
   * Validates token structure and required fields
   * @param decoded - Decoded JWT payload
   * @throws UnauthorizedException if structure is invalid
   */
  private validateTokenStructure(decoded: any): void {
    const requiredFields = ['sub', 'username', 'email', 'iat', 'exp'];

    for (const field of requiredFields) {
      if (!decoded[field]) {
        throw new UnauthorizedException(
          `Token missing required field: ${field}`,
        );
      }
    }

    // Validate field types
    if (typeof decoded.sub !== 'string') {
      throw new UnauthorizedException('Token subject must be a string');
    }
    if (typeof decoded.username !== 'string') {
      throw new UnauthorizedException('Token username must be a string');
    }
    if (typeof decoded.email !== 'string') {
      throw new UnauthorizedException('Token email must be a string');
    }
    if (typeof decoded.iat !== 'number') {
      throw new UnauthorizedException('Token issued at must be a number');
    }
    if (typeof decoded.exp !== 'number') {
      throw new UnauthorizedException('Token expiration must be a number');
    }
  }

  /**
   * Validates token expiration with buffer time
   * @param decoded - Decoded JWT payload
   * @throws UnauthorizedException if token is expired or will expire soon
   */
  private validateTokenExpiration(decoded: any): void {
    const now = Math.floor(Date.now() / 1000);
    const expiration = decoded.exp;
    const issuedAt = decoded.iat;

    // Check if token is expired
    if (now >= expiration) {
      throw new UnauthorizedException('Token has expired');
    }

    // Check if token was issued in the future (clock skew protection)
    const maxClockSkew = 60; // 1 minute
    if (issuedAt > now + maxClockSkew) {
      throw new UnauthorizedException('Token issued in the future');
    }

    // Check if token has a reasonable expiration time (max 7 days)
    const maxTokenLifetime = 7 * 24 * 60 * 60; // 7 days in seconds
    if (expiration - issuedAt > maxTokenLifetime) {
      throw new UnauthorizedException('Token has excessive expiration time');
    }

    // Log warning if token expires soon (within 1 hour)
    if (expiration - now < 3600) {
      console.warn(
        `[JWT VALIDATION] Token expires soon for user: ${decoded.sub}`,
      );
    }
  }

  /**
   * Validates token claims and business rules
   * @param decoded - Decoded JWT payload
   * @throws UnauthorizedException if claims are invalid
   */
  private validateTokenClaims(decoded: any): void {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(decoded.email)) {
      throw new UnauthorizedException('Token contains invalid email format');
    }

    // Validate username format (alphanumeric, underscore, hyphen, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(decoded.username)) {
      throw new UnauthorizedException('Token contains invalid username format');
    }

    // Validate subject format (UUID)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(decoded.sub)) {
      throw new UnauthorizedException('Token contains invalid subject format');
    }
  }

  /**
   * Extracts token from Authorization header
   * @param authHeader - Authorization header value
   * @returns Clean token string
   * @throws UnauthorizedException if header format is invalid
   */
  extractTokenFromHeader(authHeader: string): string {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const token = parts[1];
    if (!token || token.length < 10) {
      throw new UnauthorizedException('Invalid token format');
    }

    return token;
  }

  /**
   * Checks if token is close to expiration
   * @param token - JWT token to check
   * @param bufferMinutes - Buffer time in minutes (default: 15)
   * @returns True if token expires within buffer time
   */
  async isTokenExpiringSoon(
    token: string,
    bufferMinutes: number = 15,
  ): Promise<boolean> {
    try {
      const decoded = await this.validateToken(token);
      const now = Math.floor(Date.now() / 1000);
      const bufferSeconds = bufferMinutes * 60;

      return (decoded.exp || 0) - now < bufferSeconds;
    } catch (error) {
      return true; // Consider invalid tokens as expiring
    }
  }

  /**
   * Gets token expiration time
   * @param token - JWT token
   * @returns Expiration date
   */
  async getTokenExpiration(token: string): Promise<Date> {
    const decoded = await this.validateToken(token);
    return new Date((decoded.exp || 0) * 1000);
  }

  /**
   * Gets token issued at time
   * @param token - JWT token
   * @returns Issued at date
   */
  async getTokenIssuedAt(token: string): Promise<Date> {
    const decoded = await this.validateToken(token);
    return new Date((decoded.iat || 0) * 1000);
  }
}
