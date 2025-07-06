import * as bcrypt from 'bcrypt';

/**
 * Utility class for password hashing and validation operations
 */
export class PasswordUtil {
  /**
   * Get salt rounds from environment variable with fallback to 12
   */
  private static getSaltRounds(): number {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    return saltRounds >= 12 ? saltRounds : 12; // Minimum 12 rounds for security
  }

  /**
   * Hash a password using bcrypt with configurable salt rounds
   * @param password - Plain text password to hash
   * @returns Promise<string> - Hashed password
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = this.getSaltRounds();
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      return hashedPassword;
    } catch (error) {
      throw new Error(`Failed to hash password: ${error.message}`);
    }
  }

  /**
   * Compare a plain text password with a hashed password
   * @param password - Plain text password
   * @param hashedPassword - Hashed password to compare against
   * @returns Promise<boolean> - True if passwords match, false otherwise
   */
  static async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(password, hashedPassword);
      return isMatch;
    } catch (error) {
      throw new Error(`Failed to compare password: ${error.message}`);
    }
  }

  /**
   * Validate password strength according to PRD requirements
   * @param password - Password to validate
   * @returns boolean - True if password meets requirements
   */
  static validatePasswordStrength(password: string): boolean {
    // Password must be at least 8 characters and contain:
    // - At least one uppercase letter
    // - At least one lowercase letter
    // - At least one number
    // - At least one special character
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }
}
