import { IsEmail, IsString, IsUUID, IsDate, MinLength } from 'class-validator';

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

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}
