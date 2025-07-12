import {
  IsEmail,
  IsString,
  IsUUID,
  IsDate,
  MinLength,
  IsIn,
} from 'class-validator';
import { UserRole } from '../types/user.types';

/**
 * User entity representing the user model with validation
 */
export class User {
  @IsUUID()
  id: string;

  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsString()
  @MinLength(1, { message: 'Full name is required' })
  fullName: string;

  @IsUUID()
  organizationId: string;

  @IsString()
  @IsIn(['SUPER_OWNER', 'OWNER', 'ADMIN', 'AGENT'], {
    message: 'Role must be one of: SUPER_OWNER, OWNER, ADMIN, AGENT',
  })
  role: UserRole;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}
