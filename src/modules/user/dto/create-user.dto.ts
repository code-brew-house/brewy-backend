import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEmail,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for creating a new user with comprehensive validation rules
 */
export class CreateUserDto {
  /** Username with comprehensive format validation */
  @IsString({ message: 'Username must be a string' })
  @IsNotEmpty({ message: 'Username is required' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Username can only contain letters, numbers, underscores, dots, and hyphens',
  })
  @Matches(/^[^._-]/, {
    message: 'Username cannot start with special characters',
  })
  @Matches(/[^._-]$/, {
    message: 'Username cannot end with special characters',
  })
  username: string;

  /** Email address with enhanced security validation */
  @IsString({ message: 'Email must be a string' })
  @IsNotEmpty({ message: 'Email is required' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MaxLength(254, { message: 'Email address is too long' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Matches(/^[^<>;"'()\\]+$/, {
    message: 'Email contains invalid characters',
  })
  email: string;

  /** Password with comprehensive strength validation */
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
    },
  )
  password: string;

  /** Full name with format validation */
  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(1, { message: 'Full name cannot be empty' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, {
    message:
      'Full name can only contain letters, spaces, apostrophes, and hyphens',
  })
  @Matches(/^[^\s].*[^\s]$|^[^\s]$/, {
    message: 'Full name cannot start or end with spaces',
  })
  fullName: string;
}
