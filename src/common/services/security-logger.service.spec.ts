import { Test, TestingModule } from '@nestjs/testing';
import {
  SecurityLoggerService,
  SecurityEventType,
  SecurityEventSeverity,
} from './security-logger.service';

describe('SecurityLoggerService', () => {
  let service: SecurityLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecurityLoggerService],
    }).compile();

    service = module.get<SecurityLoggerService>(SecurityLoggerService);

    // Mock console methods to avoid test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logSecurityEvent', () => {
    it('should log critical events with error level', () => {
      const consoleSpy = jest.spyOn(console, 'error');

      service.logSecurityEvent({
        type: SecurityEventType.LOGIN_BRUTE_FORCE_DETECTED,
        severity: SecurityEventSeverity.CRITICAL,
        message: 'Critical security event',
        timestamp: new Date(),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-CRITICAL]',
        expect.stringContaining('Critical security event'),
      );
    });

    it('should log high severity events with error level', () => {
      const consoleSpy = jest.spyOn(console, 'error');

      service.logSecurityEvent({
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecurityEventSeverity.HIGH,
        message: 'High severity event',
        timestamp: new Date(),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-HIGH]',
        expect.stringContaining('High severity event'),
      );
    });

    it('should log medium severity events with warn level', () => {
      const consoleSpy = jest.spyOn(console, 'warn');

      service.logSecurityEvent({
        type: SecurityEventType.LOGIN_FAILED,
        severity: SecurityEventSeverity.MEDIUM,
        message: 'Medium severity event',
        timestamp: new Date(),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-MEDIUM]',
        expect.stringContaining('Medium severity event'),
      );
    });

    it('should log low severity events with log level', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      service.logSecurityEvent({
        type: SecurityEventType.LOGIN_SUCCESS,
        severity: SecurityEventSeverity.LOW,
        message: 'Low severity event',
        timestamp: new Date(),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-LOW]',
        expect.stringContaining('Low severity event'),
      );
    });
  });

  describe('logFailedLogin', () => {
    it('should log failed login with correct data', () => {
      const consoleSpy = jest.spyOn(console, 'warn');

      service.logFailedLogin(
        'testuser',
        '127.0.0.1',
        'Mozilla/5.0',
        'Invalid password',
        { attempts: 3 },
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-MEDIUM]',
        expect.stringContaining(
          'Failed login attempt for testuser: Invalid password',
        ),
      );
    });
  });

  describe('logSuccessfulLogin', () => {
    it('should log successful login with correct data', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      service.logSuccessfulLogin(
        'user-123',
        'testuser',
        'test@example.com',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-LOW]',
        expect.stringContaining('Successful login for user testuser'),
      );
    });
  });

  describe('logAccountLocked', () => {
    it('should log account lockout with high severity', () => {
      const consoleSpy = jest.spyOn(console, 'error');

      service.logAccountLocked('user-123', 'testuser', '127.0.0.1', 15);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-HIGH]',
        expect.stringContaining(
          'Account locked for user testuser for 15 minutes',
        ),
      );
    });
  });

  describe('logFailedRegistration', () => {
    it('should log failed registration with correct data', () => {
      const consoleSpy = jest.spyOn(console, 'warn');

      service.logFailedRegistration(
        'test@example.com',
        'testuser',
        '127.0.0.1',
        'Mozilla/5.0',
        'Email already exists',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-MEDIUM]',
        expect.stringContaining(
          'Failed registration attempt for test@example.com: Email already exists',
        ),
      );
    });
  });

  describe('logSuccessfulRegistration', () => {
    it('should log successful registration with correct data', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      service.logSuccessfulRegistration(
        'user-123',
        'testuser',
        'test@example.com',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-LOW]',
        expect.stringContaining('Successful registration for user testuser'),
      );
    });
  });

  describe('logTokenValidationFailure', () => {
    it('should log token validation failure with correct data', () => {
      const consoleSpy = jest.spyOn(console, 'warn');

      service.logTokenValidationFailure(
        'Invalid token format',
        '127.0.0.1',
        'Mozilla/5.0',
        '/api/protected',
        'GET',
        'Bearer invalid-token',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-MEDIUM]',
        expect.stringContaining(
          'Token validation failed: Invalid token format',
        ),
      );
    });
  });

  describe('logTokenValidationSuccess', () => {
    it('should log token validation success with correct data', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      service.logTokenValidationSuccess(
        'user-123',
        'testuser',
        '127.0.0.1',
        'Mozilla/5.0',
        '/api/protected',
        'GET',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-LOW]',
        expect.stringContaining(
          'Token validation successful for user testuser',
        ),
      );
    });
  });

  describe('logUnauthorizedAccess', () => {
    it('should log unauthorized access with high severity', () => {
      const consoleSpy = jest.spyOn(console, 'error');

      service.logUnauthorizedAccess(
        '/api/admin',
        'POST',
        '127.0.0.1',
        'Mozilla/5.0',
        'Missing token',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-HIGH]',
        expect.stringContaining(
          'Unauthorized access attempt to POST /api/admin: Missing token',
        ),
      );
    });
  });

  describe('logRateLimitExceeded', () => {
    it('should log rate limit exceeded with correct data', () => {
      const consoleSpy = jest.spyOn(console, 'warn');

      service.logRateLimitExceeded(
        '127.0.0.1',
        'Mozilla/5.0',
        '/auth/login',
        'POST',
        'auth',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-MEDIUM]',
        expect.stringContaining(
          'Rate limit exceeded for auth on POST /auth/login',
        ),
      );
    });
  });

  describe('logSuspiciousActivity', () => {
    it('should log suspicious activity with high severity', () => {
      const consoleSpy = jest.spyOn(console, 'error');

      service.logSuspiciousActivity(
        'Multiple failed login attempts from same IP',
        '127.0.0.1',
        'Mozilla/5.0',
        'user-123',
        { attempts: 10, timeWindow: '5 minutes' },
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-HIGH]',
        expect.stringContaining(
          'Suspicious activity detected: Multiple failed login attempts from same IP',
        ),
      );
    });
  });

  describe('logInputValidationFailure', () => {
    it('should log input validation failure with correct data', () => {
      const consoleSpy = jest.spyOn(console, 'warn');

      service.logInputValidationFailure(
        '/auth/register',
        'POST',
        '127.0.0.1',
        'Mozilla/5.0',
        ['email must be a valid email', 'password too short'],
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-MEDIUM]',
        expect.stringContaining(
          'Input validation failed on POST /auth/register',
        ),
      );
    });
  });

  describe('logTokenExpiringSoon', () => {
    it('should log token expiring soon with low severity', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      service.logTokenExpiringSoon('user-123', 'testuser', 15, '127.0.0.1');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY-LOW]',
        expect.stringContaining(
          'Token expiring soon for user testuser (expires in 15 minutes)',
        ),
      );
    });
  });
});
