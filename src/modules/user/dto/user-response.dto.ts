import { Exclude } from 'class-transformer';

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
