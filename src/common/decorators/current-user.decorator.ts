import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../types/request.types';

/**
 * Interface for the current user object extracted from JWT
 * @deprecated Use RequestUser from request.types.ts instead
 */
export interface CurrentUserData {
  id: string;
  username: string;
  email: string;
  fullName: string;
}

/**
 * Parameter decorator to extract the current user from JWT token
 * Now includes organization context (organizationId and role)
 *
 * Usage:
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: RequestUser) {
 *   return user;
 * }
 *
 * Or extract specific property:
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser('id') userId: string) {
 *   return userId;
 * }
 *
 * @Get('organization-data')
 * @UseGuards(JwtAuthGuard)
 * getOrgData(@CurrentUser('organizationId') orgId: string) {
 *   return this.service.findByOrganization(orgId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: RequestUser = request.user;

    if (!user) {
      return null;
    }

    // If a specific property is requested, return just that property
    if (data) {
      return user[data];
    }

    // Otherwise return the full user object with organization context
    return user;
  },
);
