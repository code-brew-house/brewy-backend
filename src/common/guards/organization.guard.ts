import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RequestUser } from '../types/request.types';

/**
 * Guard to validate organization context and ensure data access is properly scoped
 *
 * This guard ensures that users can only access data within their organization
 * and provides special handling for SUPER_OWNER role which can access cross-organization data.
 *
 * The guard performs the following validations:
 * 1. Ensures user is authenticated and has organizationId
 * 2. For SUPER_OWNER: Allows cross-organization access with optional organization targeting
 * 3. For other roles: Validates organization context matches user's organization
 * 4. Adds organizationId to request for downstream services to use
 *
 * Cross-organization access for SUPER_OWNER:
 * - Can access any organization by providing organizationId in route params (:id)
 * - Can access any organization by providing organizationId in query params (?organizationId=uuid)
 * - Can access any organization by providing X-Organization-Id header
 * - Falls back to their own organizationId if no target organization is specified
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, OrganizationGuard)
 * @Get('data')
 * getData(@CurrentUser() user: RequestUser) {
 *   // user.organizationId is guaranteed to be valid
 *   return this.service.findByOrganization(user.organizationId);
 * }
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: RequestUser = request.user;

    // User must be authenticated
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // SUPER_OWNER can access data across all organizations
    if (user.role === 'SUPER_OWNER') {
      // Extract target organization ID from various sources
      const targetOrganizationId = this.extractTargetOrganizationId(request);

      // Add target organization to request for downstream usage
      request.organizationId = targetOrganizationId || user.organizationId;

      return true;
    }

    // For other roles, ensure they have a valid organization context
    if (!user.organizationId) {
      throw new ForbiddenException('User must belong to an organization');
    }

    // Non-SUPER_OWNER users can only access their own organization
    request.organizationId = user.organizationId;

    return true;
  }

  /**
   * Extracts the target organization ID for SUPER_OWNER cross-organization access
   * Priority: route params > query params > headers
   */
  private extractTargetOrganizationId(request: any): string | null {
    // 1. Check route parameters (e.g., /organizations/:id)
    if (request.params?.id) {
      return request.params.id;
    }

    // 2. Check query parameters (e.g., ?organizationId=uuid)
    if (request.query?.organizationId) {
      return request.query.organizationId;
    }

    // 3. Check headers (e.g., X-Organization-Id)
    if (request.headers?.['x-organization-id']) {
      return request.headers['x-organization-id'];
    }

    // 4. No target organization specified
    return null;
  }
}
