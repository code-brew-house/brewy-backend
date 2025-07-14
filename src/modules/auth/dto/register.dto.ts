import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEmail,
  MinLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for user registration with comprehensive validation rules matching PRD requirements
 */
export class RegisterDto {
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
  @Matches(/^[^<>;\"'()\\\\]+$/, {
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

  /** Full name with format validation matching PRD requirements (2-100 characters) */
  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty({ message: 'Full name is required' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, {
    message:
      'Full name can only contain letters, spaces, apostrophes, and hyphens',
  })
  @Matches(/^[a-zA-Z]/, {
    message: 'Full name must start with a letter',
  })
  @Matches(/[a-zA-Z]$/, {
    message: 'Full name must end with a letter',
  })
  fullName: string;

  /** Optional organization name for Super Owner registration */
  @IsOptional()
  @IsString({ message: 'Organization name must be a string' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, {
    message: 'Organization name must be at least 2 characters long',
  })
  @MaxLength(100, {
    message: 'Organization name must not exceed 100 characters',
  })
  organizationName?: string;

  /** Optional organization contact number for Super Owner registration */
  @IsOptional()
  @IsString({ message: 'Organization contact number must be a string' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(20, { message: 'Contact number must not exceed 20 characters' })
  organizationContactNumber?: string;

  /** Optional organization email for Super Owner registration */
  @IsOptional()
  @IsString({ message: 'Organization email must be a string' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MaxLength(254, { message: 'Organization email address is too long' })
  @IsEmail({}, { message: 'Please provide a valid organization email address' })
  organizationEmail?: string;
}
