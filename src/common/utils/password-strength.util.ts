import { Injectable } from '@nestjs/common';

/**
 * Password strength validation result interface
 */
export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-100 strength score
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Password strength requirements configuration
 */
export interface PasswordStrengthConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  allowedSpecialChars: string;
  forbiddenPatterns: string[];
  checkCommonPasswords: boolean;
  checkSequentialChars: boolean;
  checkRepeatedChars: boolean;
  maxRepeatedChars: number;
}

/**
 * Default password strength configuration matching PRD requirements
 */
export const DEFAULT_PASSWORD_CONFIG: PasswordStrengthConfig = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  allowedSpecialChars: '@$!%*?&',
  forbiddenPatterns: [
    'password',
    'admin',
    'user',
    'test',
    'guest',
    'root',
    '123456',
    'qwerty',
    'abc123',
    'letmein',
    'welcome',
  ],
  checkCommonPasswords: true,
  checkSequentialChars: true,
  checkRepeatedChars: true,
  maxRepeatedChars: 2,
};

/**
 * Comprehensive password strength validation utility
 */
@Injectable()
export class PasswordStrengthUtil {
  private static readonly COMMON_PASSWORDS = [
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
    'monkey',
    'dragon',
    'master',
    'football',
    'baseball',
    'superman',
    'princess',
    'welcome1',
    'passw0rd',
    'p@ssw0rd',
    'p@ssword',
    'Password1',
    'Password123',
    '12345678',
    '1234567890',
    'iloveyou',
    'sunshine',
    'shadow',
    'computer',
    'charlie',
    'freedom',
    'trustno1',
    'hunter2',
  ];

  private static readonly SEQUENTIAL_PATTERNS = [
    '012',
    '123',
    '234',
    '345',
    '456',
    '567',
    '678',
    '789',
    '890',
    '987',
    '876',
    '765',
    '654',
    '543',
    '432',
    '321',
    '210',
    'abc',
    'bcd',
    'cde',
    'def',
    'efg',
    'fgh',
    'ghi',
    'hij',
    'ijk',
    'jkl',
    'klm',
    'lmn',
    'mno',
    'nop',
    'opq',
    'pqr',
    'qrs',
    'rst',
    'stu',
    'tuv',
    'uvw',
    'vwx',
    'wxy',
    'xyz',
    'zyx',
    'yxw',
    'xwv',
    'wvu',
    'vut',
    'uts',
    'tsr',
    'srq',
    'rqp',
    'qpo',
    'pon',
    'onm',
    'nml',
    'mlk',
    'lkj',
    'kji',
    'jih',
    'ihg',
    'hgf',
    'gfe',
    'fed',
    'edc',
    'dcb',
    'cba',
  ];

  private static readonly KEYBOARD_PATTERNS = [
    'qwerty',
    'asdf',
    'zxcv',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
    '1234567890',
    '!@#$%^&*()',
    'qwe',
    'asd',
    'zxc',
    'wer',
    'sdf',
    'xcv',
    'ert',
    'dfg',
    'cvb',
    'rty',
    'fgh',
    'vbn',
    'tyu',
    'ghj',
    'bnm',
    'yui',
    'hjk',
    'nmk',
    'uio',
    'jkl',
    'mkl',
    'iop',
    'klm',
  ];

  /**
   * Validates password strength according to configuration
   * @param password - Password to validate
   * @param config - Configuration options (uses defaults if not provided)
   * @returns Password strength validation result
   */
  static validatePasswordStrength(
    password: string,
    config: Partial<PasswordStrengthConfig> = {},
  ): PasswordStrengthResult {
    const conf = { ...DEFAULT_PASSWORD_CONFIG, ...config };
    const result: PasswordStrengthResult = {
      isValid: true,
      score: 0,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Basic validation
    if (!password || typeof password !== 'string') {
      result.errors.push('Password is required');
      result.isValid = false;
      return result;
    }

    // Length validation
    this.validateLength(password, conf, result);

    // Character requirements
    this.validateCharacterRequirements(password, conf, result);

    // Pattern checks
    this.validatePatterns(password, conf, result);

    // Calculate strength score
    result.score = this.calculateStrengthScore(password, conf, result);

    // Add suggestions based on validation results
    this.addSuggestions(result, conf);

    return result;
  }

  /**
   * Validates password length requirements
   */
  private static validateLength(
    password: string,
    config: PasswordStrengthConfig,
    result: PasswordStrengthResult,
  ): void {
    if (password.length < config.minLength) {
      result.errors.push(
        `Password must be at least ${config.minLength} characters long`,
      );
      result.isValid = false;
    }

    if (password.length > config.maxLength) {
      result.errors.push(
        `Password must not exceed ${config.maxLength} characters`,
      );
      result.isValid = false;
    }

    // Length strength scoring
    if (
      password.length >= config.minLength &&
      password.length <= config.maxLength
    ) {
      if (password.length >= 12) {
        result.score += 25; // Excellent length
      } else if (password.length >= 10) {
        result.score += 20; // Good length
      } else if (password.length >= 8) {
        result.score += 15; // Minimum acceptable
      }
    }
  }

  /**
   * Validates character requirements
   */
  private static validateCharacterRequirements(
    password: string,
    config: PasswordStrengthConfig,
    result: PasswordStrengthResult,
  ): void {
    let characterScore = 0;

    // Uppercase letters
    if (config.requireUppercase) {
      if (!/[A-Z]/.test(password)) {
        result.errors.push(
          'Password must contain at least one uppercase letter',
        );
        result.isValid = false;
      } else {
        characterScore += 15;
      }
    }

    // Lowercase letters
    if (config.requireLowercase) {
      if (!/[a-z]/.test(password)) {
        result.errors.push(
          'Password must contain at least one lowercase letter',
        );
        result.isValid = false;
      } else {
        characterScore += 15;
      }
    }

    // Numbers
    if (config.requireNumbers) {
      if (!/\d/.test(password)) {
        result.errors.push('Password must contain at least one number');
        result.isValid = false;
      } else {
        characterScore += 15;
      }
    }

    // Special characters
    if (config.requireSpecialChars) {
      const specialCharRegex = new RegExp(
        `[${this.escapeRegex(config.allowedSpecialChars)}]`,
      );
      if (!specialCharRegex.test(password)) {
        result.errors.push(
          `Password must contain at least one special character (${config.allowedSpecialChars})`,
        );
        result.isValid = false;
      } else {
        characterScore += 15;
      }
    }

    // Bonus points for character diversity
    const uniqueChars = new Set(password).size;
    const diversityBonus = Math.min(10, Math.floor(uniqueChars / 2));
    characterScore += diversityBonus;

    result.score += characterScore;
  }

  /**
   * Validates against common patterns and weak passwords
   */
  private static validatePatterns(
    password: string,
    config: PasswordStrengthConfig,
    result: PasswordStrengthResult,
  ): void {
    const lowerPassword = password.toLowerCase();

    // Check for common passwords
    if (config.checkCommonPasswords) {
      for (const commonPassword of this.COMMON_PASSWORDS) {
        if (
          lowerPassword === commonPassword.toLowerCase() ||
          lowerPassword.includes(commonPassword.toLowerCase())
        ) {
          result.errors.push(
            'Password cannot be a common password or contain common words',
          );
          result.isValid = false;
          break;
        }
      }
    }

    // Check for forbidden patterns
    for (const pattern of config.forbiddenPatterns) {
      if (lowerPassword.includes(pattern.toLowerCase())) {
        result.errors.push(`Password cannot contain the pattern: ${pattern}`);
        result.isValid = false;
      }
    }

    // Check for sequential characters
    if (config.checkSequentialChars) {
      for (const pattern of this.SEQUENTIAL_PATTERNS) {
        if (
          lowerPassword.includes(pattern) ||
          password.includes(pattern.toUpperCase())
        ) {
          result.warnings.push(
            'Password contains sequential characters which reduces security',
          );
          result.score -= 10;
          break;
        }
      }
    }

    // Check for keyboard patterns
    for (const pattern of this.KEYBOARD_PATTERNS) {
      if (lowerPassword.includes(pattern)) {
        result.warnings.push(
          'Password contains keyboard patterns which reduces security',
        );
        result.score -= 10;
        break;
      }
    }

    // Check for repeated characters
    if (config.checkRepeatedChars) {
      const repeatedChar = this.findRepeatedCharacters(
        password,
        config.maxRepeatedChars,
      );
      if (repeatedChar) {
        if (config.maxRepeatedChars <= 2) {
          result.errors.push(
            `Password cannot contain more than ${config.maxRepeatedChars} consecutive identical characters`,
          );
          result.isValid = false;
        } else {
          result.warnings.push(
            'Password contains many repeated characters which reduces security',
          );
          result.score -= 15;
        }
      }
    }

    // Check for all same characters
    if (new Set(password).size === 1) {
      result.errors.push(
        'Password cannot consist of only one repeated character',
      );
      result.isValid = false;
    }

    // Check for simple patterns (like 1111, aaaa)
    if (/^(.)\1+$/.test(password)) {
      result.errors.push('Password cannot consist of repeated characters');
      result.isValid = false;
    }

    // Personal information patterns (basic checks)
    if (/\b(name|email|phone|address|birthday|birth)\b/i.test(lowerPassword)) {
      result.warnings.push('Avoid using personal information in passwords');
      result.score -= 5;
    }

    // Date patterns
    if (
      /(19|20)\d{2}/.test(password) ||
      /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(password)
    ) {
      result.warnings.push('Avoid using dates in passwords');
      result.score -= 5;
    }
  }

  /**
   * Calculates overall password strength score
   */
  private static calculateStrengthScore(
    password: string,
    config: PasswordStrengthConfig,
    result: PasswordStrengthResult,
  ): number {
    let score = result.score;

    // Deduct points for errors
    score -= result.errors.length * 20;

    // Deduct points for warnings
    score -= result.warnings.length * 5;

    // Bonus for mixed case
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
      score += 5;
    }

    // Bonus for numbers and letters mix
    if (/[a-zA-Z]/.test(password) && /\d/.test(password)) {
      score += 5;
    }

    // Bonus for special characters and alphanumeric mix
    if (
      /[a-zA-Z\d]/.test(password) &&
      new RegExp(`[${this.escapeRegex(config.allowedSpecialChars)}]`).test(
        password,
      )
    ) {
      score += 10;
    }

    // Ensure score is within bounds
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Adds helpful suggestions based on validation results
   */
  private static addSuggestions(
    result: PasswordStrengthResult,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _config: PasswordStrengthConfig,
  ): void {
    if (result.errors.length > 0) {
      result.suggestions.push(
        'Fix the above errors to meet minimum requirements',
      );
    }

    if (result.score < 60) {
      result.suggestions.push(
        'Consider making your password longer (12+ characters recommended)',
      );
      result.suggestions.push(
        'Use a mix of uppercase, lowercase, numbers, and special characters',
      );
      result.suggestions.push(
        'Avoid common words, personal information, and predictable patterns',
      );
    }

    if (result.score < 80) {
      result.suggestions.push('Consider using a passphrase with random words');
      result.suggestions.push(
        'Add more unique characters to increase strength',
      );
    }

    if (result.warnings.length > 0) {
      result.suggestions.push('Remove predictable patterns and sequences');
      result.suggestions.push(
        'Avoid keyboard patterns and common substitutions',
      );
    }

    if (result.score >= 80) {
      result.suggestions.push(
        'Great password strength! Consider using a password manager',
      );
    }
  }

  /**
   * Finds repeated characters in password
   */
  private static findRepeatedCharacters(
    password: string,
    maxAllowed: number,
  ): string | null {
    for (let i = 0; i < password.length - maxAllowed; i++) {
      const char = password[i];
      let count = 1;

      for (let j = i + 1; j < password.length && password[j] === char; j++) {
        count++;
      }

      if (count > maxAllowed) {
        return char;
      }
    }
    return null;
  }

  /**
   * Escapes special characters for regex
   */
  private static escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Gets password strength level as string
   */
  static getStrengthLevel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Strong';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Weak';
    return 'Very Weak';
  }

  /**
   * Gets password strength color for UI (CSS class or hex)
   */
  static getStrengthColor(score: number): string {
    if (score >= 80) return '#22c55e'; // Green
    if (score >= 60) return '#3b82f6'; // Blue
    if (score >= 40) return '#f59e0b'; // Orange
    if (score >= 20) return '#ef4444'; // Red
    return '#dc2626'; // Dark red
  }

  /**
   * Generates password strength advice
   */
  static generateAdvice(result: PasswordStrengthResult): string[] {
    const advice: string[] = [];

    if (result.score < 60) {
      advice.push('🔒 Use at least 12 characters for better security');
      advice.push('🔤 Mix uppercase and lowercase letters');
      advice.push('🔢 Include numbers and special characters');
      advice.push('🚫 Avoid personal information and common words');
    }

    if (result.score >= 60 && result.score < 80) {
      advice.push('✅ Good password! Consider making it even stronger');
      advice.push('💡 Use unique, unpredictable character combinations');
      advice.push('🔐 Consider using a passphrase with random words');
    }

    if (result.score >= 80) {
      advice.push('🌟 Excellent password strength!');
      advice.push('💾 Consider using a password manager');
      advice.push('🔄 Change your password regularly');
    }

    return advice;
  }

  /**
   * Validates if password meets minimum PRD requirements
   */
  static meetsPRDRequirements(password: string): boolean {
    const result = this.validatePasswordStrength(
      password,
      DEFAULT_PASSWORD_CONFIG,
    );
    return result.isValid && result.score >= 60;
  }

  /**
   * Quick validation for forms (returns only boolean and first error)
   */
  static isValidPassword(
    password: string,
    config?: Partial<PasswordStrengthConfig>,
  ): {
    isValid: boolean;
    message?: string;
  } {
    const result = this.validatePasswordStrength(password, config);
    return {
      isValid: result.isValid,
      message: result.errors[0] || result.warnings[0],
    };
  }
}
