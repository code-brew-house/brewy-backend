import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator to extract the organization ID from the request
 *
 * This decorator extracts the organizationId from the JWT token payload
 * that was set by the JWT authentication guard.
 *
 * Usage:
 * @Get('data')
 * @UseGuards(JwtAuthGuard)
 * getData(@Organization() organizationId: string) {
 *   return this.service.findByOrganization(organizationId);
 * }
 *
 * @returns The organization ID from the authenticated user's JWT token
 */
export const Organization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.organizationId) {
      throw new Error(
        'Organization ID not found in request. Ensure JWT authentication is properly configured.',
      );
    }

    return user.organizationId;
  },
);
