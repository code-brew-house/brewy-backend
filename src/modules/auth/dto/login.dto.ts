import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for user login with comprehensive validation
 */
export class LoginDto {
  /** Email or username for login with security validation */
  @IsString({ message: 'Email or username must be a string' })
  @IsNotEmpty({ message: 'Email or username is required' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1, { message: 'Email or username cannot be empty' })
  @MaxLength(254, { message: 'Email or username is too long' })
  @Matches(/^[^<>;"'()\\]+$/, {
    message: 'Email or username contains invalid characters',
  })
  identifier: string;

  /** Password for authentication with length limits */
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(1, { message: 'Password cannot be empty' })
  @MaxLength(128, { message: 'Password is too long' })
  password: string;
}
