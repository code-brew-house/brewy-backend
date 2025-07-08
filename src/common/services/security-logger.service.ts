import { Injectable } from '@nestjs/common';

/**
 * Security Event Types for comprehensive monitoring
 */
export enum SecurityEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGIN_ACCOUNT_LOCKED = 'LOGIN_ACCOUNT_LOCKED',
  LOGIN_BRUTE_FORCE_DETECTED = 'LOGIN_BRUTE_FORCE_DETECTED',

  // Registration Events
  REGISTRATION_SUCCESS = 'REGISTRATION_SUCCESS',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  REGISTRATION_DUPLICATE_EMAIL = 'REGISTRATION_DUPLICATE_EMAIL',
  REGISTRATION_DUPLICATE_USERNAME = 'REGISTRATION_DUPLICATE_USERNAME',

  // Token Events
  TOKEN_VALIDATION_SUCCESS = 'TOKEN_VALIDATION_SUCCESS',
  TOKEN_VALIDATION_FAILED = 'TOKEN_VALIDATION_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID_FORMAT = 'TOKEN_INVALID_FORMAT',
  TOKEN_USER_MISMATCH = 'TOKEN_USER_MISMATCH',
  TOKEN_EXPIRING_SOON = 'TOKEN_EXPIRING_SOON',

  // Authorization Events
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  FORBIDDEN_ACCESS = 'FORBIDDEN_ACCESS',
  PROTECTED_ROUTE_ACCESS = 'PROTECTED_ROUTE_ACCESS',

  // Rate Limiting Events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',

  // Security Events
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  MALICIOUS_REQUEST = 'MALICIOUS_REQUEST',
  INPUT_VALIDATION_FAILED = 'INPUT_VALIDATION_FAILED',
}

/**
 * Security Event Severity Levels
 */
export enum SecurityEventSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Security Event Data Interface
 */
export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  username?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  requestId?: string;
}

/**
 * Security Logger Service for comprehensive security event monitoring
 * Logs security-related events for analysis and monitoring
 */
@Injectable()
export class SecurityLoggerService {
  /**
   * Log a security event with structured data
   * @param event - Security event data
   */
  logSecurityEvent(event: SecurityEvent): void {
    const logEntry = {
      ...event,
      component: 'SECURITY',
      version: '1.0.0',
    };

    // Format log message for different severity levels
    switch (event.severity) {
      case SecurityEventSeverity.CRITICAL:
        console.error('[SECURITY-CRITICAL]', JSON.stringify(logEntry, null, 2));
        break;
      case SecurityEventSeverity.HIGH:
        console.error('[SECURITY-HIGH]', JSON.stringify(logEntry, null, 2));
        break;
      case SecurityEventSeverity.MEDIUM:
        console.warn('[SECURITY-MEDIUM]', JSON.stringify(logEntry, null, 2));
        break;
      case SecurityEventSeverity.LOW:
        console.log('[SECURITY-LOW]', JSON.stringify(logEntry, null, 2));
        break;
      default:
        console.log('[SECURITY]', JSON.stringify(logEntry, null, 2));
    }

    // In production, you would also send to:
    // - Security Information and Event Management (SIEM) system
    // - Log aggregation service (ELK Stack, Splunk, etc.)
    // - Alert systems for critical events
    // - Database for historical analysis
  }

  /**
   * Log failed login attempt
   */
  logFailedLogin(
    identifier: string,
    ipAddress: string,
    userAgent: string,
    reason: string,
    metadata?: Record<string, any>,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.LOGIN_FAILED,
      severity: SecurityEventSeverity.MEDIUM,
      username: identifier,
      ipAddress,
      userAgent,
      message: `Failed login attempt for ${identifier}: ${reason}`,
      metadata,
      timestamp: new Date(),
    });
  }

  /**
   * Log successful login
   */
  logSuccessfulLogin(
    userId: string,
    username: string,
    email: string,
    ipAddress: string,
    userAgent: string,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.LOGIN_SUCCESS,
      severity: SecurityEventSeverity.LOW,
      userId,
      username,
      email,
      ipAddress,
      userAgent,
      message: `Successful login for user ${username}`,
      timestamp: new Date(),
    });
  }

  /**
   * Log account lockout event
   */
  logAccountLocked(
    userId: string,
    username: string,
    ipAddress: string,
    lockoutDuration: number,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.LOGIN_ACCOUNT_LOCKED,
      severity: SecurityEventSeverity.HIGH,
      userId,
      username,
      ipAddress,
      message: `Account locked for user ${username} for ${lockoutDuration} minutes`,
      metadata: { lockoutDurationMinutes: lockoutDuration },
      timestamp: new Date(),
    });
  }

  /**
   * Log failed registration attempt
   */
  logFailedRegistration(
    email: string,
    username: string,
    ipAddress: string,
    userAgent: string,
    reason: string,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.REGISTRATION_FAILED,
      severity: SecurityEventSeverity.MEDIUM,
      username,
      email,
      ipAddress,
      userAgent,
      message: `Failed registration attempt for ${email}: ${reason}`,
      timestamp: new Date(),
    });
  }

  /**
   * Log successful registration
   */
  logSuccessfulRegistration(
    userId: string,
    username: string,
    email: string,
    ipAddress: string,
    userAgent: string,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.REGISTRATION_SUCCESS,
      severity: SecurityEventSeverity.LOW,
      userId,
      username,
      email,
      ipAddress,
      userAgent,
      message: `Successful registration for user ${username}`,
      timestamp: new Date(),
    });
  }

  /**
   * Log token validation failure
   */
  logTokenValidationFailure(
    reason: string,
    ipAddress: string,
    userAgent: string,
    endpoint: string,
    method: string,
    token?: string,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.TOKEN_VALIDATION_FAILED,
      severity: SecurityEventSeverity.MEDIUM,
      ipAddress,
      userAgent,
      endpoint,
      method,
      message: `Token validation failed: ${reason}`,
      metadata: {
        tokenLength: token ? token.length : 0,
        hasBearer: token ? token.startsWith('Bearer ') : false,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Log successful token validation
   */
  logTokenValidationSuccess(
    userId: string,
    username: string,
    ipAddress: string,
    userAgent: string,
    endpoint: string,
    method: string,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.TOKEN_VALIDATION_SUCCESS,
      severity: SecurityEventSeverity.LOW,
      userId,
      username,
      ipAddress,
      userAgent,
      endpoint,
      method,
      message: `Token validation successful for user ${username}`,
      timestamp: new Date(),
    });
  }

  /**
   * Log unauthorized access attempt
   */
  logUnauthorizedAccess(
    endpoint: string,
    method: string,
    ipAddress: string,
    userAgent: string,
    reason: string,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.UNAUTHORIZED_ACCESS,
      severity: SecurityEventSeverity.HIGH,
      ipAddress,
      userAgent,
      endpoint,
      method,
      message: `Unauthorized access attempt to ${method} ${endpoint}: ${reason}`,
      timestamp: new Date(),
    });
  }

  /**
   * Log rate limit exceeded event
   */
  logRateLimitExceeded(
    ipAddress: string,
    userAgent: string,
    endpoint: string,
    method: string,
    limitType: string,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecurityEventSeverity.MEDIUM,
      ipAddress,
      userAgent,
      endpoint,
      method,
      message: `Rate limit exceeded for ${limitType} on ${method} ${endpoint}`,
      metadata: { limitType },
      timestamp: new Date(),
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(
    description: string,
    ipAddress: string,
    userAgent: string,
    userId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: SecurityEventSeverity.HIGH,
      userId,
      ipAddress,
      userAgent,
      message: `Suspicious activity detected: ${description}`,
      metadata,
      timestamp: new Date(),
    });
  }

  /**
   * Log input validation failure
   */
  logInputValidationFailure(
    endpoint: string,
    method: string,
    ipAddress: string,
    userAgent: string,
    validationErrors: string[],
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.INPUT_VALIDATION_FAILED,
      severity: SecurityEventSeverity.MEDIUM,
      ipAddress,
      userAgent,
      endpoint,
      method,
      message: `Input validation failed on ${method} ${endpoint}`,
      metadata: { validationErrors },
      timestamp: new Date(),
    });
  }

  /**
   * Log token expiring soon warning
   */
  logTokenExpiringSoon(
    userId: string,
    username: string,
    expiresIn: number,
    ipAddress: string,
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.TOKEN_EXPIRING_SOON,
      severity: SecurityEventSeverity.LOW,
      userId,
      username,
      ipAddress,
      message: `Token expiring soon for user ${username} (expires in ${expiresIn} minutes)`,
      metadata: { expiresInMinutes: expiresIn },
      timestamp: new Date(),
    });
  }
}
