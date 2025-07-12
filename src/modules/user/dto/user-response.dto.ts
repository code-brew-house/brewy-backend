import { Exclude } from 'class-transformer';
import { UserRole } from '../types/user.types';

/**
 * DTO for user responses that excludes sensitive information
 */
export class UserResponseDto {
  /** User ID */
  id: string;

  /** Username */
  username: string;

  /** Email address */
  email: string;

  /** Full name */
  fullName: string;

  /** Organization ID */
  organizationId: string;

  /** User role within organization */
  role: UserRole;

  /** Account creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Password is excluded from API responses */
  @Exclude()
  password: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
