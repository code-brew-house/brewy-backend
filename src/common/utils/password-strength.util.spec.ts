import { PasswordStrengthUtil } from './password-strength.util';

describe('PasswordStrengthUtil', () => {
  describe('validatePasswordStrength', () => {
    it('should accept a strong password', () => {
      const strongPassword = 'MyStr0ng!P4ssw0rd';
      const result =
        PasswordStrengthUtil.validatePasswordStrength(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(60);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password that is too short', () => {
      const shortPassword = 'Abc1!';
      const result =
        PasswordStrengthUtil.validatePasswordStrength(shortPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long',
      );
    });

    it('should reject password that is too long', () => {
      const longPassword = 'A'.repeat(129) + '1!b';
      const result =
        PasswordStrengthUtil.validatePasswordStrength(longPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must not exceed 128 characters',
      );
    });

    it('should reject password without uppercase letters', () => {
      const password = 'mypassword123!';
      const result = PasswordStrengthUtil.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter',
      );
    });

    it('should reject password without lowercase letters', () => {
      const password = 'MYPASSWORD123!';
      const result = PasswordStrengthUtil.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter',
      );
    });

    it('should reject password without numbers', () => {
      const password = 'MyPassword!';
      const result = PasswordStrengthUtil.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number',
      );
    });

    it('should reject password without special characters', () => {
      const password = 'MyPassword123';
      const result = PasswordStrengthUtil.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character (@$!%*?&)',
      );
    });

    it('should reject common passwords', () => {
      const commonPasswords = [
        'password123',
        'Password1',
        'admin123!',
        'qwerty123!',
      ];

      commonPasswords.forEach((password) => {
        const result = PasswordStrengthUtil.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Password cannot be a common password or contain common words',
        );
      });
    });

    it('should detect sequential characters', () => {
      const password = 'MyP4ss123!ABC';
      const result = PasswordStrengthUtil.validatePasswordStrength(password);

      expect(result.warnings).toContain(
        'Password contains sequential characters which reduces security',
      );
      expect(result.score).toBeLessThan(100);
    });

    it('should detect keyboard patterns', () => {
      const password = 'MyQwerty1!';
      const result = PasswordStrengthUtil.validatePasswordStrength(password);

      expect(result.warnings).toContain(
        'Password contains keyboard patterns which reduces security',
      );
    });

    it('should reject passwords with too many repeated characters', () => {
      const password = 'Myyyy1234!';
      const result = PasswordStrengthUtil.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password cannot contain more than 2 consecutive identical characters',
      );
    });

    it('should reject passwords with all same characters', () => {
      const password = 'aaaaaaaa';
      const result = PasswordStrengthUtil.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password cannot consist of repeated characters',
      );
    });

    it('should detect personal information patterns', () => {
      const password = 'myphone1234567!';
      const result = PasswordStrengthUtil.validatePasswordStrength(password);

      // Should have warnings (either personal info or sequential chars)
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some(
          (w) =>
            w.includes('personal information') ||
            w.includes('sequential characters'),
        ),
      ).toBe(true);
    });

    it('should detect date patterns', () => {
      const passwords = ['MyP4ss2024!', 'P4ss12/25/1990!'];

      passwords.forEach((password) => {
        const result = PasswordStrengthUtil.validatePasswordStrength(password);
        expect(result.warnings).toContain('Avoid using dates in passwords');
      });
    });

    it('should handle null/undefined passwords', () => {
      const result1 = PasswordStrengthUtil.validatePasswordStrength(
        null as any,
      );
      const result2 = PasswordStrengthUtil.validatePasswordStrength(
        undefined as any,
      );

      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Password is required');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Password is required');
    });

    it('should handle non-string passwords', () => {
      const result = PasswordStrengthUtil.validatePasswordStrength(123 as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should calculate appropriate scores for different strength levels', () => {
      const weakPassword = 'password';
      const fairPassword = 'MyPass123';
      const goodPassword = 'MyP4ss123!';
      const strongPassword = 'MyStr0ng!P4ssw0rd';
      const excellentPassword = 'MyExc3ll3nt!Unicorn&Magic7';

      const weakResult =
        PasswordStrengthUtil.validatePasswordStrength(weakPassword);
      const fairResult =
        PasswordStrengthUtil.validatePasswordStrength(fairPassword);
      const goodResult =
        PasswordStrengthUtil.validatePasswordStrength(goodPassword);
      const strongResult =
        PasswordStrengthUtil.validatePasswordStrength(strongPassword);
      const excellentResult =
        PasswordStrengthUtil.validatePasswordStrength(excellentPassword);

      expect(weakResult.score).toBeLessThan(20);
      expect(fairResult.score).toBeLessThan(60);
      expect(goodResult.score).toBeGreaterThanOrEqual(40);
      expect(strongResult.score).toBeGreaterThanOrEqual(60);
      expect(excellentResult.score).toBeGreaterThanOrEqual(80);
    });

    it('should provide helpful suggestions', () => {
      const weakPassword = 'weak';
      const result =
        PasswordStrengthUtil.validatePasswordStrength(weakPassword);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions).toContain(
        'Fix the above errors to meet minimum requirements',
      );
    });

    it('should work with custom configuration', () => {
      const customConfig = {
        minLength: 12,
        requireSpecialChars: false,
        allowedSpecialChars: '@#$',
        maxRepeatedChars: 3,
        checkCommonPasswords: false,
      };

      const password = 'MyUniqueVeryLong123'; // 19 chars, no special chars, not common
      const result = PasswordStrengthUtil.validatePasswordStrength(
        password,
        customConfig,
      );

      // Should pass with custom config (no special chars required)
      expect(result.isValid).toBe(true);
    });
  });

  describe('getStrengthLevel', () => {
    it('should return correct strength levels', () => {
      expect(PasswordStrengthUtil.getStrengthLevel(95)).toBe('Excellent');
      expect(PasswordStrengthUtil.getStrengthLevel(85)).toBe('Strong');
      expect(PasswordStrengthUtil.getStrengthLevel(70)).toBe('Good');
      expect(PasswordStrengthUtil.getStrengthLevel(50)).toBe('Fair');
      expect(PasswordStrengthUtil.getStrengthLevel(30)).toBe('Weak');
      expect(PasswordStrengthUtil.getStrengthLevel(10)).toBe('Very Weak');
    });
  });

  describe('getStrengthColor', () => {
    it('should return appropriate colors for different scores', () => {
      expect(PasswordStrengthUtil.getStrengthColor(90)).toBe('#22c55e'); // Green
      expect(PasswordStrengthUtil.getStrengthColor(70)).toBe('#3b82f6'); // Blue
      expect(PasswordStrengthUtil.getStrengthColor(50)).toBe('#f59e0b'); // Orange
      expect(PasswordStrengthUtil.getStrengthColor(30)).toBe('#ef4444'); // Red
      expect(PasswordStrengthUtil.getStrengthColor(10)).toBe('#dc2626'); // Dark red
    });
  });

  describe('generateAdvice', () => {
    it('should provide appropriate advice for weak passwords', () => {
      const weakPassword = 'weak';
      const result =
        PasswordStrengthUtil.validatePasswordStrength(weakPassword);
      const advice = PasswordStrengthUtil.generateAdvice(result);

      expect(advice.length).toBeGreaterThan(0);
      expect(advice.some((a) => a.includes('12 characters'))).toBe(true);
    });

    it('should provide appropriate advice for good passwords', () => {
      const goodPassword = 'MyGoodP4ss123!';
      const result =
        PasswordStrengthUtil.validatePasswordStrength(goodPassword);
      const advice = PasswordStrengthUtil.generateAdvice(result);

      // Should provide some advice
      expect(advice.length).toBeGreaterThan(0);
    });

    it('should provide appropriate advice for excellent passwords', () => {
      const excellentPassword = 'MyExc3ll3nt!Unicorn&Magic7';
      const result =
        PasswordStrengthUtil.validatePasswordStrength(excellentPassword);
      const advice = PasswordStrengthUtil.generateAdvice(result);

      expect(advice.some((a) => a.includes('Excellent'))).toBe(true);
    });
  });

  describe('meetsPRDRequirements', () => {
    it('should return true for passwords meeting PRD requirements', () => {
      // Use the same password that passed the strong password test
      const validPassword = 'MyStr0ng!P4ssw0rd';
      expect(PasswordStrengthUtil.meetsPRDRequirements(validPassword)).toBe(
        true,
      );
    });

    it('should return false for passwords not meeting PRD requirements', () => {
      const invalidPasswords = [
        'weak',
        'password123',
        'NoSpecial123',
        'nonumbers!',
        'NOLOWERCASE123!',
      ];

      invalidPasswords.forEach((password) => {
        expect(PasswordStrengthUtil.meetsPRDRequirements(password)).toBe(false);
      });
    });
  });

  describe('isValidPassword', () => {
    it('should return validation result with message for quick checks', () => {
      const weakPassword = 'weak';
      const strongPassword = 'MyStr0ng!Pass';

      const weakResult = PasswordStrengthUtil.isValidPassword(weakPassword);
      const strongResult = PasswordStrengthUtil.isValidPassword(strongPassword);

      expect(weakResult.isValid).toBe(false);
      expect(weakResult.message).toBeDefined();
      expect(strongResult.isValid).toBe(true);
      expect(strongResult.message).toBeUndefined();
    });

    it('should work with custom configuration', () => {
      const password = 'MyUniqueP4ssw0rd12345'; // No special chars
      const customConfig = { requireSpecialChars: false };

      const result = PasswordStrengthUtil.isValidPassword(
        password,
        customConfig,
      );
      expect(result.isValid).toBe(true);
    });
  });

  describe('Edge Cases and Security Features', () => {
    it('should handle very long passwords appropriately', () => {
      const veryLongPassword = 'A'.repeat(200) + '1!b';
      const result =
        PasswordStrengthUtil.validatePasswordStrength(veryLongPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must not exceed 128 characters',
      );
    });

    it('should detect multiple security issues', () => {
      const problematicPassword = 'password123!!!'; // Common word + repeated chars
      const result =
        PasswordStrengthUtil.validatePasswordStrength(problematicPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should provide score adjustments for various factors', () => {
      const mixedCasePassword = 'MyGoodP@ss123';
      const result =
        PasswordStrengthUtil.validatePasswordStrength(mixedCasePassword);

      // Should get bonus points for mixed case, numbers+letters, special chars
      expect(result.score).toBeGreaterThan(60);
    });

    it('should handle empty string password', () => {
      const result = PasswordStrengthUtil.validatePasswordStrength('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should detect forbidden patterns from config', () => {
      const customConfig = {
        forbiddenPatterns: ['company', 'brand'],
      };

      const password = 'MyCompany123!';
      const result = PasswordStrengthUtil.validatePasswordStrength(
        password,
        customConfig,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password cannot contain the pattern: company',
      );
    });

    it('should handle different special character requirements', () => {
      const customConfig = {
        allowedSpecialChars: '#$%',
      };

      const passwordWithAllowed = 'MyPass123#';
      const passwordWithDisallowed = 'MyPass123!';

      const allowedResult = PasswordStrengthUtil.validatePasswordStrength(
        passwordWithAllowed,
        customConfig,
      );
      const disallowedResult = PasswordStrengthUtil.validatePasswordStrength(
        passwordWithDisallowed,
        customConfig,
      );

      expect(allowedResult.isValid).toBe(true);
      expect(disallowedResult.isValid).toBe(false);
    });
  });
});
