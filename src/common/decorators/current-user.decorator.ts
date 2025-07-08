import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Interface for the current user object extracted from JWT
 */
export interface CurrentUserData {
  id: string;
  username: string;
  email: string;
  fullName: string;
}

/**
 * Parameter decorator to extract the current user from JWT token
 *
 * Usage:
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: CurrentUserData) {
 *   return user;
 * }
 *
 * Or extract specific property:
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser('id') userId: string) {
 *   return userId;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    // If a specific property is requested, return just that property
    if (data) {
      return user[data];
    }

    // Otherwise return the full user object
    return user;
  },
);
