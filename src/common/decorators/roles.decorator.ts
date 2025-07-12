import { SetMetadata } from '@nestjs/common';

/**
 * User roles within an organization
 */
export type UserRole = 'SUPER_OWNER' | 'OWNER' | 'ADMIN' | 'AGENT';

/**
 * Metadata key for storing required roles
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for accessing an endpoint
 *
 * Usage:
 * @Roles('OWNER', 'ADMIN')
 * @Get('sensitive-data')
 * getSensitiveData() {
 *   return { data: 'sensitive' };
 * }
 *
 * @param roles - Array of roles that are allowed to access the endpoint
 * @returns SetMetadata decorator with roles information
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
