import { ValidationUtil } from './validation.util';

describe('ValidationUtil', () => {
  describe('validatePasswordStrength', () => {
    it('should accept a strong password', () => {
      const strongPassword = 'MyStr0ng!Pass';
      const result = ValidationUtil.validatePasswordStrength(strongPassword);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject passwords that are too short', () => {
      const shortPassword = 'Abc1!';
      const result = ValidationUtil.validatePasswordStrength(shortPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long',
      );
    });

    it('should reject passwords without lowercase letters', () => {
      const password = 'PASSWORD123!';
      const result = ValidationUtil.validatePasswordStrength(password);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter',
      );
    });

    it('should reject passwords without uppercase letters', () => {
      const password = 'password123!';
      const result = ValidationUtil.validatePasswordStrength(password);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter',
      );
    });

    it('should reject passwords without numbers', () => {
      const password = 'Password!';
      const result = ValidationUtil.validatePasswordStrength(password);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number',
      );
    });

    it('should reject passwords without special characters', () => {
      const password = 'Password123';
      const result = ValidationUtil.validatePasswordStrength(password);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character (@$!%*?&)',
      );
    });

    it('should reject passwords that are too long', () => {
      const longPassword = 'A'.repeat(129) + '1!';
      const result = ValidationUtil.validatePasswordStrength(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must not exceed 128 characters',
      );
    });

    it('should reject passwords with repeated characters', () => {
      const repeatedPassword = 'aaaaaaaa';
      const result = ValidationUtil.validatePasswordStrength(repeatedPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password cannot consist of repeated characters',
      );
    });

    it('should reject passwords with sequential numbers', () => {
      const sequentialPassword = 'MyPass123!';
      const result =
        ValidationUtil.validatePasswordStrength(sequentialPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password cannot contain sequential numbers',
      );
    });

    it('should reject common weak passwords', () => {
      const weakPassword = 'Password123!';
      const result = ValidationUtil.validatePasswordStrength(weakPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password cannot contain common words or patterns',
      );
    });

    it('should handle null input', () => {
      const result = ValidationUtil.validatePasswordStrength(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should handle empty string', () => {
      const result = ValidationUtil.validatePasswordStrength('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });
  });

  describe('validateUsername', () => {
    it('should accept a valid username', () => {
      const validUsername = 'john_doe123';
      const result = ValidationUtil.validateUsername(validUsername);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept username with dots and hyphens', () => {
      const validUsername = 'john.doe-123';
      const result = ValidationUtil.validateUsername(validUsername);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject usernames that are too short', () => {
      const shortUsername = 'ab';
      const result = ValidationUtil.validateUsername(shortUsername);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username must be at least 3 characters long',
      );
    });

    it('should reject usernames that are too long', () => {
      const longUsername = 'a'.repeat(31);
      const result = ValidationUtil.validateUsername(longUsername);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username must not exceed 30 characters');
    });

    it('should reject usernames with invalid characters', () => {
      const invalidUsername = 'john@doe';
      const result = ValidationUtil.validateUsername(invalidUsername);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username can only contain letters, numbers, underscores, dots, and hyphens',
      );
    });

    it('should reject usernames starting with special characters', () => {
      const invalidUsername = '.johndoe';
      const result = ValidationUtil.validateUsername(invalidUsername);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username cannot start or end with special characters',
      );
    });

    it('should reject usernames ending with special characters', () => {
      const invalidUsername = 'johndoe.';
      const result = ValidationUtil.validateUsername(invalidUsername);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username cannot start or end with special characters',
      );
    });

    it('should reject usernames with consecutive special characters', () => {
      const invalidUsername = 'john..doe';
      const result = ValidationUtil.validateUsername(invalidUsername);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username cannot contain consecutive special characters',
      );
    });

    it('should reject reserved words', () => {
      const reservedUsername = 'admin';
      const result = ValidationUtil.validateUsername(reservedUsername);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username cannot be a reserved word');
    });

    it('should handle null input', () => {
      const result = ValidationUtil.validateUsername(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username is required');
    });

    it('should handle empty string', () => {
      const result = ValidationUtil.validateUsername('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username is required');
    });
  });

  describe('validateFullName', () => {
    it('should accept a valid full name', () => {
      const validName = 'John Doe';
      const result = ValidationUtil.validateFullName(validName);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept names with apostrophes and hyphens', () => {
      const validName = "Mary O'Connor-Smith";
      const result = ValidationUtil.validateFullName(validName);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept names with accented characters', () => {
      const validName = 'José María González';
      const result = ValidationUtil.validateFullName(validName);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty names', () => {
      const emptyName = '';
      const result = ValidationUtil.validateFullName(emptyName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Full name is required');
    });

    it('should reject names that are too long', () => {
      const longName = 'A'.repeat(101);
      const result = ValidationUtil.validateFullName(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Full name must not exceed 100 characters',
      );
    });

    it('should reject names with invalid characters', () => {
      const invalidName = 'John123 Doe';
      const result = ValidationUtil.validateFullName(invalidName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Full name can only contain letters, spaces, apostrophes, and hyphens',
      );
    });

    it('should reject names with leading or trailing spaces', () => {
      const nameWithSpaces = ' John Doe ';
      const result = ValidationUtil.validateFullName(nameWithSpaces);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Full name cannot start or end with spaces',
      );
    });

    it('should reject names with multiple consecutive spaces', () => {
      const nameWithSpaces = 'John  Doe';
      const result = ValidationUtil.validateFullName(nameWithSpaces);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Full name cannot contain multiple consecutive spaces',
      );
    });

    it('should reject names without letters', () => {
      const noLettersName = '123 456';
      const result = ValidationUtil.validateFullName(noLettersName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Full name must contain at least one letter',
      );
    });

    it('should handle null input', () => {
      const result = ValidationUtil.validateFullName(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Full name is required');
    });
  });

  describe('validateEmail', () => {
    it('should accept a valid email', () => {
      const validEmail = 'user@example.com';
      const result = ValidationUtil.validateEmail(validEmail);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept emails with plus signs and dots', () => {
      const validEmail = 'user.name+tag@example.com';
      const result = ValidationUtil.validateEmail(validEmail);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject emails that are too long', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = ValidationUtil.validateEmail(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email address is too long');
    });

    it('should reject invalid email formats', () => {
      const invalidEmail = 'not-an-email';
      const result = ValidationUtil.validateEmail(invalidEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please provide a valid email address');
    });

    it('should reject emails with dangerous characters', () => {
      const dangerousEmail = 'user<script>@example.com';
      const result = ValidationUtil.validateEmail(dangerousEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email contains invalid characters');
    });

    it('should reject emails with consecutive dots', () => {
      const invalidEmail = 'user..name@example.com';
      const result = ValidationUtil.validateEmail(invalidEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email cannot contain consecutive dots');
    });

    it('should reject emails with dots at start of local part', () => {
      const invalidEmail = '.user@example.com';
      const result = ValidationUtil.validateEmail(invalidEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Email local part cannot start or end with a dot',
      );
    });

    it('should reject emails with dots at end of local part', () => {
      const invalidEmail = 'user.@example.com';
      const result = ValidationUtil.validateEmail(invalidEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Email local part cannot start or end with a dot',
      );
    });

    it('should reject emails with local part too long', () => {
      const longLocalPart = 'a'.repeat(65);
      const invalidEmail = `${longLocalPart}@example.com`;
      const result = ValidationUtil.validateEmail(invalidEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email local part is too long');
    });

    it('should handle null input', () => {
      const result = ValidationUtil.validateEmail(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    it('should handle empty string', () => {
      const result = ValidationUtil.validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });
  });
});
