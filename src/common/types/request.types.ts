import { Request } from 'express';

/**
 * Enhanced user data interface with organization context
 * This extends the basic user data to include organization-specific information
 */
export interface RequestUser {
  /** User ID */
  id: string;

  /** Username */
  username: string;

  /** Email address */
  email: string;

  /** Full name */
  fullName: string;

  /** Organization ID the user belongs to */
  organizationId: string;

  /** User's role within the organization */
  role: 'SUPER_OWNER' | 'OWNER' | 'ADMIN' | 'AGENT';
}

/**
 * Extended Express Request interface with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  /** Authenticated user with organization context */
  user: RequestUser;
}
