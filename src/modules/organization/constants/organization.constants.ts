/**
 * Organization configuration constants and default limits
 */
export const ORGANIZATION_LIMITS = {
  /**
   * Default maximum number of users per organization
   */
  DEFAULT_MAX_USERS: 10,

  /**
   * Default maximum number of concurrent jobs per organization
   */
  DEFAULT_MAX_CONCURRENT_JOBS: 5,

  /**
   * Minimum number of users required per organization
   */
  MIN_USERS: 1,

  /**
   * Maximum number of users allowed per organization (hard limit)
   */
  ABSOLUTE_MAX_USERS: 1000,

  /**
   * Maximum number of concurrent jobs allowed per organization (hard limit)
   */
  ABSOLUTE_MAX_CONCURRENT_JOBS: 50,
} as const;

/**
 * Organization validation constants
 */
export const ORGANIZATION_VALIDATION = {
  /**
   * Minimum length for organization name
   */
  NAME_MIN_LENGTH: 2,

  /**
   * Maximum length for organization name
   */
  NAME_MAX_LENGTH: 100,

  /**
   * Maximum length for contact number
   */
  CONTACT_NUMBER_MAX_LENGTH: 20,

  /**
   * Email validation regex pattern
   */
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

/**
 * Organization role hierarchy constants
 */
export const ORGANIZATION_ROLES = {
  /**
   * Role hierarchy for permission checks (higher number = higher privilege)
   */
  HIERARCHY: {
    AGENT: 1,
    ADMIN: 2,
    OWNER: 3,
    SUPER_OWNER: 4,
  },
} as const;
