import { PasswordUtil } from './password.util';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('PasswordUtil', () => {
  // Save original env value to restore later
  const originalBcryptSaltRounds = process.env.BCRYPT_SALT_ROUNDS;

  afterEach(() => {
    jest.clearAllMocks();
    // Restore original env value
    if (originalBcryptSaltRounds !== undefined) {
      process.env.BCRYPT_SALT_ROUNDS = originalBcryptSaltRounds;
    } else {
      delete process.env.BCRYPT_SALT_ROUNDS;
    }
  });

  describe('getSaltRounds', () => {
    it('should return default 12 when BCRYPT_SALT_ROUNDS is not set', () => {
      delete process.env.BCRYPT_SALT_ROUNDS;

      // Access private method via bracket notation for testing
      const saltRounds = (PasswordUtil as any).getSaltRounds();

      expect(saltRounds).toBe(12);
    });

    it('should return configured salt rounds when valid', () => {
      process.env.BCRYPT_SALT_ROUNDS = '14';

      const saltRounds = (PasswordUtil as any).getSaltRounds();

      expect(saltRounds).toBe(14);
    });

    it('should return minimum 12 when configured value is too low', () => {
      process.env.BCRYPT_SALT_ROUNDS = '8';

      const saltRounds = (PasswordUtil as any).getSaltRounds();

      expect(saltRounds).toBe(12);
    });

    it('should return minimum 12 when configured value is invalid', () => {
      process.env.BCRYPT_SALT_ROUNDS = 'invalid';

      const saltRounds = (PasswordUtil as any).getSaltRounds();

      expect(saltRounds).toBe(12);
    });

    it('should return minimum 12 when configured value is empty string', () => {
      process.env.BCRYPT_SALT_ROUNDS = '';

      const saltRounds = (PasswordUtil as any).getSaltRounds();

      expect(saltRounds).toBe(12);
    });

    it('should handle very high salt rounds', () => {
      process.env.BCRYPT_SALT_ROUNDS = '20';

      const saltRounds = (PasswordUtil as any).getSaltRounds();

      expect(saltRounds).toBe(20);
    });
  });

  describe('hashPassword', () => {
    it('should hash password successfully with default salt rounds', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = '$2b$12$hashedPassword';

      delete process.env.BCRYPT_SALT_ROUNDS;
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await PasswordUtil.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });

    it('should hash password with configured salt rounds', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = '$2b$14$hashedPassword';

      process.env.BCRYPT_SALT_ROUNDS = '14';
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await PasswordUtil.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 14);
    });

    it('should throw error when bcrypt.hash fails', async () => {
      const password = 'TestPassword123!';
      const bcryptError = new Error('Bcrypt error');

      (mockedBcrypt.hash as jest.Mock).mockRejectedValue(bcryptError);

      await expect(PasswordUtil.hashPassword(password)).rejects.toThrow(
        'Failed to hash password: Bcrypt error',
      );
    });

    it('should handle empty password', async () => {
      const password = '';
      const hashedPassword = '$2b$12$emptyPasswordHash';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await PasswordUtil.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });

    it('should handle very long password', async () => {
      const password = 'a'.repeat(1000) + 'A1!';
      const hashedPassword = '$2b$12$longPasswordHash';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await PasswordUtil.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });

    it('should handle special characters in password', async () => {
      const password = 'Test@#$%^&*()_+-=[]{}|;:,.<>?Password123!';
      const hashedPassword = '$2b$12$specialCharsHash';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await PasswordUtil.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });

    it('should handle unicode characters in password', async () => {
      const password = 'Tëst🔐Pássw0rd!';
      const hashedPassword = '$2b$12$unicodePasswordHash';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await PasswordUtil.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });
  });

  describe('comparePassword', () => {
    it('should return true when passwords match', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = '$2b$12$hashedPassword';

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await PasswordUtil.comparePassword(
        password,
        hashedPassword,
      );

      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        password,
        hashedPassword,
      );
    });

    it('should return false when passwords do not match', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = '$2b$12$differentHashedPassword';

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await PasswordUtil.comparePassword(
        password,
        hashedPassword,
      );

      expect(result).toBe(false);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        password,
        hashedPassword,
      );
    });

    it('should throw error when bcrypt.compare fails', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = '$2b$12$hashedPassword';
      const bcryptError = new Error('Comparison error');

      (mockedBcrypt.compare as jest.Mock).mockRejectedValue(bcryptError);

      await expect(
        PasswordUtil.comparePassword(password, hashedPassword),
      ).rejects.toThrow('Failed to compare password: Comparison error');
    });

    it('should handle empty password', async () => {
      const password = '';
      const hashedPassword = '$2b$12$hashedPassword';

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await PasswordUtil.comparePassword(
        password,
        hashedPassword,
      );

      expect(result).toBe(false);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        password,
        hashedPassword,
      );
    });

    it('should handle empty hashed password', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = '';

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await PasswordUtil.comparePassword(
        password,
        hashedPassword,
      );

      expect(result).toBe(false);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        password,
        hashedPassword,
      );
    });

    it('should handle malformed hash', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = 'not-a-valid-hash';
      const bcryptError = new Error('Invalid hash format');

      (mockedBcrypt.compare as jest.Mock).mockRejectedValue(bcryptError);

      await expect(
        PasswordUtil.comparePassword(password, hashedPassword),
      ).rejects.toThrow('Failed to compare password: Invalid hash format');
    });

    it('should handle special characters in comparison', async () => {
      const password = 'Test@#$%^&*()Password123!';
      const hashedPassword = '$2b$12$hashedPassword';

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await PasswordUtil.comparePassword(
        password,
        hashedPassword,
      );

      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        password,
        hashedPassword,
      );
    });

    it('should handle unicode characters in comparison', async () => {
      const password = 'Tëst🔐Pássw0rd!';
      const hashedPassword = '$2b$12$hashedPassword';

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await PasswordUtil.comparePassword(
        password,
        hashedPassword,
      );

      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        password,
        hashedPassword,
      );
    });
  });

  describe('validatePasswordStrength', () => {
    describe('valid passwords', () => {
      it('should return true for password meeting all requirements', () => {
        const password = 'TestPassword123!';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(true);
      });

      it('should return true for minimum valid password', () => {
        const password = 'Aa1!bbbb';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(true);
      });

      it('should return true for password with all special characters', () => {
        const password = 'TestPass123@$!%*?&';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(true);
      });

      it('should return true for very long password', () => {
        const password = 'TestPassword123!' + 'a'.repeat(50);

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(true);
      });

      it('should return true with different special characters', () => {
        const passwords = [
          'TestPass123@',
          'TestPass123$',
          'TestPass123!',
          'TestPass123%',
          'TestPass123*',
          'TestPass123?',
          'TestPass123&',
        ];

        passwords.forEach((password) => {
          expect(PasswordUtil.validatePasswordStrength(password)).toBe(true);
        });
      });
    });

    describe('invalid passwords', () => {
      it('should return false for password shorter than 8 characters', () => {
        const password = 'Test12!';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for password without uppercase letter', () => {
        const password = 'testpassword123!';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for password without lowercase letter', () => {
        const password = 'TESTPASSWORD123!';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for password without number', () => {
        const password = 'TestPassword!';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for password without special character', () => {
        const password = 'TestPassword123';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for empty password', () => {
        const password = '';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for password with only spaces', () => {
        const password = '        ';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for password with unsupported special characters', () => {
        const password = 'TestPassword123#'; // # is not in the allowed set

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for password with only letters', () => {
        const password = 'TestPassword';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for password with only numbers', () => {
        const password = '12345678';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for password with only special characters', () => {
        const password = '@$!%*?&@';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle null input gracefully', () => {
        const result = PasswordUtil.validatePasswordStrength(null as any);

        expect(result).toBe(false);
      });

      it('should handle undefined input gracefully', () => {
        const result = PasswordUtil.validatePasswordStrength(undefined as any);

        expect(result).toBe(false);
      });

      it('should return false for password with whitespace', () => {
        const password = 'Test Password123!';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should return false for password with tabs and newlines', () => {
        const password = 'Test\tPassword\n123!';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should handle unicode characters correctly', () => {
        const password = 'Tëst🔐Pássw0rd!'; // Contains unicode, should fail current regex

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(false);
      });

      it('should validate exactly 8 characters', () => {
        const password = 'TestPa1!';

        const result = PasswordUtil.validatePasswordStrength(password);

        expect(result).toBe(true);
      });

      it('should handle very long passwords correctly', () => {
        const longPassword = 'TestPassword123!' + 'a'.repeat(1000);

        const result = PasswordUtil.validatePasswordStrength(longPassword);

        expect(result).toBe(true);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should hash and compare password successfully', async () => {
      const originalPassword = 'TestPassword123!';

      // Mock bcrypt for this integration test
      const hashedPassword = '$2b$12$actualHashedPassword';
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      // Hash the password
      const hashed = await PasswordUtil.hashPassword(originalPassword);
      expect(hashed).toBe(hashedPassword);

      // Compare the password
      const isMatch = await PasswordUtil.comparePassword(
        originalPassword,
        hashed,
      );
      expect(isMatch).toBe(true);
    });

    it('should validate password strength before hashing', async () => {
      const weakPassword = 'weak';
      const strongPassword = 'StrongPassword123!';

      // Validate weak password
      expect(PasswordUtil.validatePasswordStrength(weakPassword)).toBe(false);

      // Validate strong password
      expect(PasswordUtil.validatePasswordStrength(strongPassword)).toBe(true);

      // Hash only the strong password
      const hashedPassword = '$2b$12$hashedStrongPassword';
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await PasswordUtil.hashPassword(strongPassword);
      expect(result).toBe(hashedPassword);
    });

    it('should handle concurrent password operations', async () => {
      const passwords = ['Password1!', 'Password2!', 'Password3!'];
      const hashedPasswords = ['$2b$12$hash1', '$2b$12$hash2', '$2b$12$hash3'];

      mockedBcrypt.hash
        .mockResolvedValueOnce(hashedPasswords[0] as never)
        .mockResolvedValueOnce(hashedPasswords[1] as never)
        .mockResolvedValueOnce(hashedPasswords[2] as never);

      const hashPromises = passwords.map((password) =>
        PasswordUtil.hashPassword(password),
      );

      const results = await Promise.all(hashPromises);

      expect(results).toEqual(hashedPasswords);
      expect(mockedBcrypt.hash).toHaveBeenCalledTimes(3);
    });
  });
});
