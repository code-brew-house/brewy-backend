import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

/**
 * DTO for creating a new user with validation rules
 */
export class CreateUserDto {
  /** Username must be at least 3 characters long */
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username: string;

  /** Valid email address */
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  /** Password must be at least 8 characters with uppercase, lowercase, number, and special character */
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  /** Full name is required */
  @IsString()
  @MinLength(1, { message: 'Full name is required' })
  fullName: string;
}
