import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, UserRole } from '../decorators/roles.decorator';
import { RequestUser } from '../types/request.types';

/**
 * Guard to check if the authenticated user has the required roles
 *
 * This guard works in conjunction with the @Roles decorator to protect endpoints
 * based on user roles. It validates that the user has at least one of the required roles.
 *
 * Role hierarchy (from highest to lowest):
 * 1. SUPER_OWNER - Can access everything across all organizations
 * 2. OWNER - Can access everything within their organization
 * 3. ADMIN - Can access most features within their organization
 * 4. AGENT - Can access basic features within their organization
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('OWNER', 'ADMIN')
 * @Get('sensitive-data')
 * getSensitiveData() {
 *   return { data: 'sensitive' };
 * }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: RequestUser = request.user;

    // User must be authenticated
    if (!user || !user.role) {
      return false;
    }

    // Check if user has one of the required roles
    const hasRole = requiredRoles.includes(user.role);

    // SUPER_OWNER can access everything regardless of role requirements
    const isSuperOwner = user.role === 'SUPER_OWNER';

    return hasRole || isSuperOwner;
  }
}
