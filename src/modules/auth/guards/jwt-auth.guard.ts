import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * JWT Authentication Guard for protecting routes that require authentication
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Determines if the current request can activate the route
   * @param context - Execution context containing request information
   * @returns Promise or Observable indicating if access is granted
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  /**
   * Handles authentication errors and provides consistent error responses
   * @param err - Authentication error
   * @param user - User object (if authentication succeeded)
   * @param info - Additional information about the authentication attempt
   * @returns User object or throws UnauthorizedException
   */
  handleRequest(err: any, user: any, info: any) {
    if (err) {
      console.error(`[JWT GUARD] Authentication error: ${err.message}`);
      throw err;
    }

    if (!user) {
      console.error(
        `[JWT GUARD] Authentication failed: ${info?.message || 'No user found'}`,
      );
      throw new UnauthorizedException('Authentication required');
    }

    console.log(`[JWT GUARD] Authentication successful for user: ${user.id}`);
    return user;
  }
}
