import { Injectable } from '@nestjs/common';
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { SanitizationUtil } from './sanitization.util';

/**
 * Utility class for custom validation decorators and validation logic
 */
@Injectable()
export class ValidationUtil {
  /**
   * Validates password strength according to security requirements
   * @param password - Password to validate
   * @returns Object with validation result and detailed errors
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push(
        'Password must contain at least one special character (@$!%*?&)',
      );
    }

    // Check for common weak patterns
    if (/^(.)\1+$/.test(password)) {
      errors.push('Password cannot consist of repeated characters');
    }

    if (
      /(012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210)/.test(
        password,
      )
    ) {
      errors.push('Password cannot contain sequential numbers');
    }

    if (
      /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|zyx|yxw|xwv|wvu|vut|uts|tsr|srq|rqp|qpo|pon|onm|nml|mlk|lkj|kji|jih|ihg|hgf|gfe|fed|edc|dcb|cba)/i.test(
        password,
      )
    ) {
      errors.push('Password cannot contain sequential letters');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password',
      'password123',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password1',
      'admin',
      'letmein',
      'welcome',
    ];

    if (commonPasswords.some((weak) => password.toLowerCase().includes(weak))) {
      errors.push('Password cannot contain common words or patterns');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates username format and constraints
   * @param username - Username to validate
   * @returns Object with validation result and errors
   */
  static validateUsername(username: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!username || typeof username !== 'string') {
      errors.push('Username is required');
      return { isValid: false, errors };
    }

    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }

    if (username.length > 30) {
      errors.push('Username must not exceed 30 characters');
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      errors.push(
        'Username can only contain letters, numbers, underscores, dots, and hyphens',
      );
    }

    if (/^[._-]/.test(username) || /[._-]$/.test(username)) {
      errors.push('Username cannot start or end with special characters');
    }

    if (/[._-]{2,}/.test(username)) {
      errors.push('Username cannot contain consecutive special characters');
    }

    // Check for reserved words
    const reservedWords = [
      'admin',
      'root',
      'system',
      'test',
      'user',
      'null',
      'undefined',
      'api',
      'www',
      'mail',
      'ftp',
      'http',
      'https',
      'support',
    ];

    if (reservedWords.includes(username.toLowerCase())) {
      errors.push('Username cannot be a reserved word');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates full name format
   * @param fullName - Full name to validate
   * @returns Object with validation result and errors
   */
  static validateFullName(fullName: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!fullName || typeof fullName !== 'string') {
      errors.push('Full name is required');
      return { isValid: false, errors };
    }

    const trimmed = fullName.trim();

    if (trimmed.length < 1) {
      errors.push('Full name cannot be empty');
    }

    if (trimmed.length > 100) {
      errors.push('Full name must not exceed 100 characters');
    }

    if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(trimmed)) {
      errors.push(
        'Full name can only contain letters, spaces, apostrophes, and hyphens',
      );
    }

    if (/^\s|\s$/.test(fullName)) {
      errors.push('Full name cannot start or end with spaces');
    }

    if (/\s{2,}/.test(trimmed)) {
      errors.push('Full name cannot contain multiple consecutive spaces');
    }

    // Must contain at least one letter
    if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) {
      errors.push('Full name must contain at least one letter');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates email format with enhanced security checks
   * @param email - Email to validate
   * @returns Object with validation result and errors
   */
  static validateEmail(email: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!email || typeof email !== 'string') {
      errors.push('Email is required');
      return { isValid: false, errors };
    }

    const trimmed = email.trim().toLowerCase();

    if (trimmed.length > 254) {
      errors.push('Email address is too long');
    }

    // Basic email regex (more permissive than RFC 5322 but secure)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      errors.push('Please provide a valid email address');
    }

    // Check for dangerous characters that might bypass sanitization
    if (/[<>;"'()\\]/.test(email)) {
      errors.push('Email contains invalid characters');
    }

    // Domain length validation
    const parts = trimmed.split('@');
    if (parts.length === 2) {
      const [localPart, domain] = parts;

      if (localPart.length > 64) {
        errors.push('Email local part is too long');
      }

      if (domain.length > 253) {
        errors.push('Email domain is too long');
      }

      // Check for consecutive dots
      if (/\.{2,}/.test(trimmed)) {
        errors.push('Email cannot contain consecutive dots');
      }

      // Check for dots at start/end of local part
      if (/^\.|\.$/.test(localPart)) {
        errors.push('Email local part cannot start or end with a dot');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Custom validator for password strength
 */
@ValidatorConstraint({ name: 'passwordStrength', async: false })
export class PasswordStrengthConstraint
  implements ValidatorConstraintInterface
{
  validate(
    password: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: ValidationArguments,
  ) {
    const result = ValidationUtil.validatePasswordStrength(password);
    return result.isValid;
  }

  defaultMessage(args: ValidationArguments) {
    const result = ValidationUtil.validatePasswordStrength(args.value);
    return result.errors.join('; ');
  }
}

/**
 * Custom validator for username format
 */
@ValidatorConstraint({ name: 'usernameFormat', async: false })
export class UsernameFormatConstraint implements ValidatorConstraintInterface {
  validate(
    username: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: ValidationArguments,
  ) {
    const result = ValidationUtil.validateUsername(username);
    return result.isValid;
  }

  defaultMessage(args: ValidationArguments) {
    const result = ValidationUtil.validateUsername(args.value);
    return result.errors.join('; ');
  }
}

/**
 * Custom validator for full name format
 */
@ValidatorConstraint({ name: 'fullNameFormat', async: false })
export class FullNameFormatConstraint implements ValidatorConstraintInterface {
  validate(
    fullName: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: ValidationArguments,
  ) {
    const result = ValidationUtil.validateFullName(fullName);
    return result.isValid;
  }

  defaultMessage(args: ValidationArguments) {
    const result = ValidationUtil.validateFullName(args.value);
    return result.errors.join('; ');
  }
}

/**
 * Custom validator for enhanced email validation
 */
@ValidatorConstraint({ name: 'enhancedEmail', async: false })
export class EnhancedEmailConstraint implements ValidatorConstraintInterface {
  validate(
    email: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: ValidationArguments,
  ) {
    const result = ValidationUtil.validateEmail(email);
    return result.isValid;
  }

  defaultMessage(args: ValidationArguments) {
    const result = ValidationUtil.validateEmail(args.value);
    return result.errors.join('; ');
  }
}

/**
 * Custom validator for sanitized input
 */
@ValidatorConstraint({ name: 'sanitizedInput', async: false })
export class SanitizedInputConstraint implements ValidatorConstraintInterface {
  validate(
    value: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: ValidationArguments,
  ) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    // Check if input is the same after sanitization
    const sanitized = SanitizationUtil.sanitizeInput(value);
    return sanitized === value.trim();
  }

  defaultMessage(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: ValidationArguments,
  ) {
    return 'Input contains potentially dangerous content';
  }
}

// Decorator functions for easier use

/**
 * Validates password strength according to security requirements
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: PasswordStrengthConstraint,
    });
  };
}

/**
 * Validates username format and constraints
 */
export function IsValidUsername(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: UsernameFormatConstraint,
    });
  };
}

/**
 * Validates full name format
 */
export function IsValidFullName(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: FullNameFormatConstraint,
    });
  };
}

/**
 * Enhanced email validation with security checks
 */
export function IsEnhancedEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: EnhancedEmailConstraint,
    });
  };
}

/**
 * Validates that input is safe (sanitized)
 */
export function IsSanitizedInput(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: SanitizedInputConstraint,
    });
  };
}
