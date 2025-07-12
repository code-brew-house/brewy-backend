import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for creating a new organization with comprehensive validation
 */
export class CreateOrganizationDto {
  /** Organization name with format validation */
  @IsString({ message: 'Organization name must be a string' })
  @IsNotEmpty({ message: 'Organization name is required' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, {
    message: 'Organization name must be at least 2 characters long',
  })
  @MaxLength(100, {
    message: 'Organization name must not exceed 100 characters',
  })
  @Matches(/^[a-zA-Z0-9\u00c0-\u00ff\s.'-]+$/, {
    message:
      'Organization name can only contain letters, numbers, spaces, dots, apostrophes, and hyphens',
  })
  @Matches(/^[^\s].*[^\s]$|^[^\s]$/, {
    message: 'Organization name cannot start or end with spaces',
  })
  name: string;

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

  /** Contact number with phone number validation */
  @IsString({ message: 'Contact number must be a string' })
  @IsNotEmpty({ message: 'Contact number is required' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(10, {
    message: 'Contact number must be at least 10 characters long',
  })
  @MaxLength(20, { message: 'Contact number must not exceed 20 characters' })
  @Matches(/^[\d\s\-\(\)\+]+$/, {
    message:
      'Contact number can only contain digits, spaces, hyphens, parentheses, and plus signs',
  })
  @Matches(/^\+?[\d\s\-\(\)]+$/, {
    message: 'Contact number must start with a digit or plus sign',
  })
  contactNumber: string;
}
