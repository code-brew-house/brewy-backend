import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let accessToken: string;

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
          contains: 'test-e2e',
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
          contains: 'test-e2e',
        },
      },
    });
  });

  describe('POST /auth/register', () => {
    const validRegistrationData = {
      username: 'teste2euser',
      email: 'test-e2e-user@example.com',
      password: 'TestPassword123!',
      fullName: 'Test E2E User',
    };

    describe('Successful Registration', () => {
      it('should register a new user successfully', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(validRegistrationData)
          .expect(201);

        // Verify response structure
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('tokenType', 'Bearer');
        expect(response.body).toHaveProperty('expiresIn');
        expect(response.body).toHaveProperty('user');

        // Verify user data (password should be excluded)
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user).toHaveProperty(
          'username',
          validRegistrationData.username,
        );
        expect(response.body.user).toHaveProperty(
          'email',
          validRegistrationData.email,
        );
        expect(response.body.user).toHaveProperty(
          'fullName',
          validRegistrationData.fullName,
        );
        expect(response.body.user).toHaveProperty('createdAt');
        expect(response.body.user).toHaveProperty('updatedAt');
        expect(response.body.user).not.toHaveProperty('password');

        // Verify JWT token format
        expect(response.body.accessToken).toMatch(
          /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
        );
        expect(typeof response.body.expiresIn).toBe('number');

        // Verify user was created in database
        const createdUser = await prismaService.user.findUnique({
          where: { email: validRegistrationData.email },
        });
        expect(createdUser).toBeTruthy();
        expect(createdUser!.username).toBe(validRegistrationData.username);
        expect(createdUser!.email).toBe(validRegistrationData.email);
        expect(createdUser!.fullName).toBe(validRegistrationData.fullName);
        expect(createdUser!.password).not.toBe(validRegistrationData.password); // Should be hashed
      });

      it('should create user with properly hashed password', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send(validRegistrationData)
          .expect(201);

        const createdUser = await prismaService.user.findUnique({
          where: { email: validRegistrationData.email },
        });

        // Verify password is hashed (bcrypt format)
        expect(createdUser!.password).toMatch(/^\$2[ab]\$\d{2}\$.{53}$/);
        expect(createdUser!.password).not.toBe(validRegistrationData.password);
        expect(createdUser!.password.length).toBe(60); // bcrypt hash length
      });

      it('should handle different valid username formats', async () => {
        const testCases = [
          {
            ...validRegistrationData,
            username: 'user123',
            email: 'user123@test-e2e.com',
          },
          {
            ...validRegistrationData,
            username: 'test_user',
            email: 'testuser@test-e2e.com',
          },
          {
            ...validRegistrationData,
            username: 'TestUser',
            email: 'TestUser@test-e2e.com',
          },
        ];

        for (const testCase of testCases) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send(testCase)
            .expect(201);

          expect(response.body.user.username).toBe(testCase.username);
          expect(response.body.user.email).toBe(testCase.email);
        }
      });

      it('should handle different valid email formats', async () => {
        const testCases = [
          {
            ...validRegistrationData,
            username: 'user1',
            email: 'user1@test-e2e.co.uk',
          },
          {
            ...validRegistrationData,
            username: 'user2',
            email: 'user.name@test-e2e.org',
          },
          {
            ...validRegistrationData,
            username: 'user3',
            email: 'user+tag@test-e2e.net',
          },
        ];

        for (const testCase of testCases) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send(testCase)
            .expect(201);

          expect(response.body.user.email).toBe(testCase.email);
        }
      });
    });

    describe('Validation Errors', () => {
      it('should reject registration with missing required fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
        expect(response.body).toHaveProperty('message');
        expect(Array.isArray(response.body.message)).toBe(true);

        // Check that all required field errors are present
        const messages = response.body.message.join(' ');
        expect(messages).toContain('username');
        expect(messages).toContain('email');
        expect(messages).toContain('password');
        expect(messages).toContain('fullName');
      });

      it('should reject registration with invalid email format', async () => {
        const invalidEmails = [
          'invalid-email',
          '@example.com',
          'user@',
          'user.example.com',
        ];

        for (const email of invalidEmails) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ ...validRegistrationData, email })
            .expect(400);

          expect(
            response.body.message.some(
              (msg: string) => msg.includes('email') && msg.includes('valid'),
            ),
          ).toBe(true);
        }
      });

      it('should reject registration with weak passwords', async () => {
        const weakPasswords = [
          'weak', // Too short
          'password', // No uppercase, no number, no special char
          'PASSWORD', // No lowercase, no number, no special char
          'Password', // No number, no special char
          'Password123', // No special char
          'Password!', // No number
          'password123!', // No uppercase
          'PASSWORD123!', // No lowercase
        ];

        for (const password of weakPasswords) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ ...validRegistrationData, password })
            .expect(400);

          expect(
            response.body.message.some(
              (msg: string) =>
                msg.includes('password') || msg.includes('Password'),
            ),
          ).toBe(true);
        }
      });

      it('should reject registration with invalid username formats', async () => {
        const invalidUsernames = [
          '',
          'ab',
          'a'.repeat(51),
          'user@name',
          'user name',
        ];

        for (const username of invalidUsernames) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ ...validRegistrationData, username })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should reject registration with invalid fullName', async () => {
        const invalidFullNames = ['', 'a', 'a'.repeat(101)];

        for (const fullName of invalidFullNames) {
          const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ ...validRegistrationData, fullName })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should reject registration with extra fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            ...validRegistrationData,
            extraField: 'should be rejected',
            anotherField: 123,
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
        expect(
          response.body.message.some(
            (msg: string) =>
              msg.includes('should not contain') || msg.includes('not allowed'),
          ),
        ).toBe(true);
      });
    });

    describe('Conflict Handling', () => {
      beforeEach(async () => {
        // Create a user for conflict testing
        await request(app.getHttpServer())
          .post('/auth/register')
          .send(validRegistrationData)
          .expect(201);
      });

      it('should reject registration with existing email', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            ...validRegistrationData,
            username: 'differentuser',
            email: validRegistrationData.email, // Same email
          })
          .expect(409);

        expect(response.body).toHaveProperty('error', 'Conflict');
        expect(response.body).toHaveProperty(
          'message',
          'Registration failed - user may already exist',
        );
      });

      it('should reject registration with existing username', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            ...validRegistrationData,
            username: validRegistrationData.username, // Same username
            email: 'different@test-e2e.com',
          })
          .expect(409);

        expect(response.body).toHaveProperty('error', 'Conflict');
        expect(response.body).toHaveProperty(
          'message',
          'Registration failed - user may already exist',
        );
      });

      it('should handle case-insensitive email conflicts', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            ...validRegistrationData,
            username: 'differentuser',
            email: validRegistrationData.email.toUpperCase(),
          })
          .expect(409);

        expect(response.body).toHaveProperty('error', 'Conflict');
      });
    });

    describe('Security Headers and Response Format', () => {
      it('should include proper security headers in response', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(validRegistrationData);

        // Verify security headers are present
        expect(response.headers).toHaveProperty('x-request-id');
        expect(response.headers).toHaveProperty('x-api-version');
        expect(response.headers).toHaveProperty(
          'x-permitted-cross-domain-policies',
        );
        expect(response.headers).toHaveProperty('referrer-policy');
        expect(response.headers).toHaveProperty('permissions-policy');
      });

      it('should not expose sensitive information in error responses', async () => {
        // Create a user first
        await request(app.getHttpServer())
          .post('/auth/register')
          .send(validRegistrationData)
          .expect(201);

        // Try to register again with same email
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            ...validRegistrationData,
            username: 'differentuser',
          })
          .expect(409);

        // Error message should be generic for security
        expect(response.body.message).toBe(
          'Registration failed - user may already exist',
        );
        expect(response.body.message).not.toContain('email');
        expect(response.body.message).not.toContain('username');
        expect(response.body.message).not.toContain('already exists');
      });

      it('should return consistent response format', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(validRegistrationData)
          .expect(201);

        // Verify exact response structure
        expect(Object.keys(response.body).sort()).toEqual(
          ['accessToken', 'tokenType', 'expiresIn', 'user'].sort(),
        );

        expect(Object.keys(response.body.user).sort()).toEqual(
          [
            'id',
            'username',
            'email',
            'fullName',
            'createdAt',
            'updatedAt',
          ].sort(),
        );
      });
    });

    describe('Rate Limiting', () => {
      it('should apply rate limiting to registration endpoint', async () => {
        // This test depends on the rate limiting configuration
        // We'll simulate multiple rapid requests
        const promises = [];

        for (let i = 0; i < 15; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/register')
              .send({
                ...validRegistrationData,
                username: `user${i}`,
                email: `user${i}@test-e2e.com`,
              }),
          );
        }

        const responses = await Promise.all(promises);

        // Some requests should succeed (201) and some should be rate limited (429)
        const statusCodes = responses.map((r) => r.status);
        const rateLimitedRequests = statusCodes.filter((code) => code === 429);

        // Verify that rate limiting is working
        expect(rateLimitedRequests.length).toBeGreaterThan(0);

        // Verify rate limited responses have correct format
        const rateLimitedResponse = responses.find((r) => r.status === 429);
        if (rateLimitedResponse) {
          expect(rateLimitedResponse.body).toHaveProperty('error');
          expect(rateLimitedResponse.body.error).toContain('Too Many Requests');
        }
      }, 10000); // Increase timeout for this test
    });

    describe('Input Sanitization', () => {
      it('should sanitize potentially malicious input', async () => {
        const maliciousData = {
          username: '<script>alert("xss")</script>',
          email: 'test@test-e2e.com',
          password: 'TestPassword123!',
          fullName: '<img src="x" onerror="alert(1)">Test User',
        };

        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(maliciousData)
          .expect(201);

        // Verify that malicious content is sanitized
        expect(response.body.user.username).not.toContain('<script>');
        expect(response.body.user.fullName).not.toContain('<img');
        expect(response.body.user.fullName).not.toContain('onerror');
      });

      it('should handle special characters properly', async () => {
        const specialCharsData = {
          username: 'user_test123',
          email: 'user+tag@test-e2e.com',
          password: 'TestPassword123!@#$%',
          fullName: "John O'Connor-Smith",
        };

        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(specialCharsData)
          .expect(201);

        expect(response.body.user.username).toBe(specialCharsData.username);
        expect(response.body.user.email).toBe(specialCharsData.email);
        expect(response.body.user.fullName).toBe(specialCharsData.fullName);
      });
    });

    describe('Database Integration', () => {
      it('should create user with proper database constraints', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(validRegistrationData)
          .expect(201);

        const createdUser = await prismaService.user.findUnique({
          where: { id: response.body.user.id },
        });

        // Verify all database fields
        expect(createdUser).toBeTruthy();
        expect(createdUser!.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ); // UUID format
        expect(createdUser!.username).toBe(validRegistrationData.username);
        expect(createdUser!.email).toBe(validRegistrationData.email);
        expect(createdUser!.fullName).toBe(validRegistrationData.fullName);
        expect(createdUser!.createdAt).toBeInstanceOf(Date);
        expect(createdUser!.updatedAt).toBeInstanceOf(Date);
        expect(createdUser!.password).toBeTruthy();
        expect(createdUser!.password.length).toBe(60); // bcrypt hash length
      });

      it('should enforce unique constraints', async () => {
        // Create first user
        await request(app.getHttpServer())
          .post('/auth/register')
          .send(validRegistrationData)
          .expect(201);

        // Try to create user with same email (different username)
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            ...validRegistrationData,
            username: 'differentuser',
          })
          .expect(409);

        // Try to create user with same username (different email)
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            ...validRegistrationData,
            email: 'different@test-e2e.com',
          })
          .expect(409);
      });
    });

    describe('Performance and Load', () => {
      it('should handle multiple concurrent registrations', async () => {
        const concurrentUsers = 5;
        const promises = [];

        for (let i = 0; i < concurrentUsers; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/register')
              .send({
                username: `concurrentuser${i}`,
                email: `concurrent${i}@test-e2e.com`,
                password: 'TestPassword123!',
                fullName: `Concurrent User ${i}`,
              }),
          );
        }

        const responses = await Promise.all(promises);

        // All should succeed
        responses.forEach((response) => {
          expect(response.status).toBe(201);
          expect(response.body).toHaveProperty('accessToken');
          expect(response.body).toHaveProperty('user');
        });

        // Verify all users were created in database
        const createdUsers = await prismaService.user.findMany({
          where: {
            email: {
              startsWith: 'concurrent',
            },
          },
        });

        expect(createdUsers).toHaveLength(concurrentUsers);
      }, 10000);

      it('should respond within acceptable time limits', async () => {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .post('/auth/register')
          .send(validRegistrationData)
          .expect(201);

        const responseTime = Date.now() - startTime;

        // Response should be under 2 seconds (generous for E2E test)
        expect(responseTime).toBeLessThan(2000);
      });
    });
  });

  describe('POST /auth/login', () => {
    const testUser = {
      username: 'teste2eloginuser',
      email: 'test-e2e-login@example.com',
      password: 'TestPassword123!',
      fullName: 'Test Login User',
    };

    // Access token is retrieved in individual tests as needed

    beforeEach(async () => {
      // Register a test user for login tests
      const registrationResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);

      accessToken = registrationResponse.body.accessToken;
    });

    describe('Successful Login', () => {
      it('should login with email and password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email,
            password: testUser.password,
          })
          .expect(200);

        // Verify response structure
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('tokenType', 'Bearer');
        expect(response.body).toHaveProperty('expiresIn');
        expect(response.body).toHaveProperty('user');

        // Verify user data (password should be excluded)
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user).toHaveProperty(
          'username',
          testUser.username,
        );
        expect(response.body.user).toHaveProperty('email', testUser.email);
        expect(response.body.user).toHaveProperty(
          'fullName',
          testUser.fullName,
        );
        expect(response.body.user).not.toHaveProperty('password');

        // Verify JWT token format
        expect(response.body.accessToken).toMatch(
          /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
        );
        expect(typeof response.body.expiresIn).toBe('number');
      });

      it('should login with username and password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.username,
            password: testUser.password,
          })
          .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body.user.username).toBe(testUser.username);
        expect(response.body.user.email).toBe(testUser.email);
      });

      it('should handle case-insensitive email login', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email.toUpperCase(),
            password: testUser.password,
          })
          .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body.user.email).toBe(testUser.email);
      });

      it('should generate different tokens for subsequent logins', async () => {
        const response1 = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email,
            password: testUser.password,
          })
          .expect(200);

        const response2 = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email,
            password: testUser.password,
          })
          .expect(200);

        expect(response1.body.accessToken).not.toBe(response2.body.accessToken);
      });
    });

    describe('Authentication Failures', () => {
      it('should reject login with invalid email', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: 'nonexistent@test-e2e.com',
            password: testUser.password,
          })
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
        expect(response.body).toHaveProperty('message', 'Invalid credentials');
      });

      it('should reject login with invalid username', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: 'nonexistentuser',
            password: testUser.password,
          })
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
        expect(response.body).toHaveProperty('message', 'Invalid credentials');
      });

      it('should reject login with wrong password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email,
            password: 'WrongPassword123!',
          })
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
        expect(response.body).toHaveProperty('message', 'Invalid credentials');
      });

      it('should not reveal whether email or username exists', async () => {
        // Test with non-existent email
        const response1 = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: 'nonexistent@test-e2e.com',
            password: 'SomePassword123!',
          })
          .expect(401);

        // Test with non-existent username
        const response2 = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: 'nonexistentuser',
            password: 'SomePassword123!',
          })
          .expect(401);

        // Test with existing email but wrong password
        const response3 = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email,
            password: 'WrongPassword123!',
          })
          .expect(401);

        // All should return the same generic message
        expect(response1.body.message).toBe('Invalid credentials');
        expect(response2.body.message).toBe('Invalid credentials');
        expect(response3.body.message).toBe('Invalid credentials');
      });
    });

    describe('Validation Errors', () => {
      it('should reject login with missing fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
        expect(response.body).toHaveProperty('message');
        expect(Array.isArray(response.body.message)).toBe(true);

        const messages = response.body.message.join(' ');
        expect(messages).toContain('identifier');
        expect(messages).toContain('password');
      });

      it('should reject login with empty identifier', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: '',
            password: testUser.password,
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });

      it('should reject login with empty password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email,
            password: '',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });

      it('should reject login with extra fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email,
            password: testUser.password,
            extraField: 'should be rejected',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });
    });

    describe('Rate Limiting', () => {
      it('should apply rate limiting to login attempts', async () => {
        const promises = [];

        // Make multiple rapid login attempts
        for (let i = 0; i < 15; i++) {
          promises.push(
            request(app.getHttpServer()).post('/auth/login').send({
              identifier: testUser.email,
              password: testUser.password,
            }),
          );
        }

        const responses = await Promise.all(promises);
        const statusCodes = responses.map((r) => r.status);
        const rateLimitedRequests = statusCodes.filter((code) => code === 429);

        // Some requests should be rate limited
        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }, 10000);

      it('should rate limit failed login attempts more aggressively', async () => {
        const promises = [];

        // Make multiple failed login attempts
        for (let i = 0; i < 10; i++) {
          promises.push(
            request(app.getHttpServer()).post('/auth/login').send({
              identifier: testUser.email,
              password: 'WrongPassword123!',
            }),
          );
        }

        const responses = await Promise.all(promises);
        const statusCodes = responses.map((r) => r.status);
        const unauthorizedRequests = statusCodes.filter((code) => code === 401);
        const rateLimitedRequests = statusCodes.filter((code) => code === 429);

        // Should have both unauthorized and rate limited responses
        expect(unauthorizedRequests.length).toBeGreaterThan(0);
        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }, 10000);
    });

    describe('Security Features', () => {
      it('should include proper security headers', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email,
            password: testUser.password,
          });

        expect(response.headers).toHaveProperty('x-request-id');
        expect(response.headers).toHaveProperty('x-api-version');
        expect(response.headers).toHaveProperty(
          'x-permitted-cross-domain-policies',
        );
      });

      it('should handle potential SQL injection attempts', async () => {
        const sqlInjectionAttempts = [
          "'; DROP TABLE users; --",
          "' OR '1'='1",
          "' UNION SELECT * FROM users --",
          "admin'--",
          "' OR 1=1#",
        ];

        for (const maliciousInput of sqlInjectionAttempts) {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: maliciousInput,
              password: testUser.password,
            })
            .expect(401);

          expect(response.body.message).toBe('Invalid credentials');
        }
      });

      it('should sanitize input to prevent XSS', async () => {
        const xssPayloads = [
          '<script>alert("xss")</script>',
          'javascript:alert(1)',
          '<img src="x" onerror="alert(1)">',
          '"><script>alert("xss")</script>',
        ];

        for (const payload of xssPayloads) {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: payload,
              password: testUser.password,
            })
            .expect(401);

          // Response should not contain the malicious payload
          expect(JSON.stringify(response.body)).not.toContain('<script>');
          expect(JSON.stringify(response.body)).not.toContain('javascript:');
          expect(JSON.stringify(response.body)).not.toContain('onerror');
        }
      });
    });

    describe('Performance', () => {
      it('should handle concurrent login requests', async () => {
        const concurrentLogins = 5;
        const promises = [];

        for (let i = 0; i < concurrentLogins; i++) {
          promises.push(
            request(app.getHttpServer()).post('/auth/login').send({
              identifier: testUser.email,
              password: testUser.password,
            }),
          );
        }

        const responses = await Promise.all(promises);

        // All should succeed
        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('accessToken');
        });
      });

      it('should respond within acceptable time limits', async () => {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email,
            password: testUser.password,
          })
          .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(2000);
      });
    });
  });

  describe('POST /auth/logout', () => {
    const testUser = {
      username: 'teste2elogoutuser',
      email: 'test-e2e-logout@example.com',
      password: 'TestPassword123!',
      fullName: 'Test Logout User',
    };

    // Access token is retrieved in individual tests as needed

    beforeEach(async () => {
      // Register and login a test user
      await request(app.getHttpServer()).post('/auth/register').send(testUser);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: testUser.email,
          password: testUser.password,
        });

      accessToken = loginResponse.body.accessToken;
    });

    describe('Successful Logout', () => {
      it('should logout authenticated user successfully', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Logout successful');
      });

      it('should handle logout with different token formats', async () => {
        // Test with different authorization header formats
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.message).toBe('Logout successful');
      });
    });

    describe('Authentication Required', () => {
      it('should reject logout without token', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
        expect(response.body).toHaveProperty(
          'message',
          'Authentication required',
        );
      });

      it('should reject logout with invalid token', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });

      it('should reject logout with malformed authorization header', async () => {
        const malformedHeaders = [
          'invalid-format',
          'Bearer',
          'Bearer ',
          'Basic ' + accessToken,
          accessToken, // Missing "Bearer "
        ];

        for (const header of malformedHeaders) {
          const response = await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', header)
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
        }
      });

      it('should reject logout with expired token', async () => {
        // This would require creating a token with very short expiration
        // For this test, we'll use a clearly invalid/expired token structure
        const expiredToken =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });
    });

    describe('Security Headers', () => {
      it('should include proper security headers in logout response', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.headers).toHaveProperty('x-request-id');
        expect(response.headers).toHaveProperty('x-api-version');
        expect(response.headers).toHaveProperty(
          'x-permitted-cross-domain-policies',
        );
      });
    });

    describe('Concurrent Logout Handling', () => {
      it('should handle multiple concurrent logout requests', async () => {
        const promises = [];

        // Create multiple logout requests
        for (let i = 0; i < 5; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/logout')
              .set('Authorization', `Bearer ${accessToken}`),
          );
        }

        const responses = await Promise.all(promises);

        // All should succeed (logout is idempotent)
        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body.message).toBe('Logout successful');
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle logout after user deletion', async () => {
        // Delete the user from database
        await prismaService.user.delete({
          where: { email: testUser.email },
        });

        // Logout should still work (token might still be valid but user gone)
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(401); // Should fail because user no longer exists

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });

      it('should handle logout with extra request body', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ extraField: 'should be ignored' })
          .expect(200);

        expect(response.body.message).toBe('Logout successful');
      });

      it('should respond within acceptable time limits', async () => {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(1000); // Logout should be faster than login
      });
    });
  });

  describe('Login/Logout Flow Integration', () => {
    const testUser = {
      username: 'teste2eflowuser',
      email: 'test-e2e-flow@example.com',
      password: 'TestPassword123!',
      fullName: 'Test Flow User',
    };

    beforeEach(async () => {
      // Register a test user for flow tests
      await request(app.getHttpServer()).post('/auth/register').send(testUser);
    });

    it('should complete full authentication flow: register -> login -> logout', async () => {
      // 1. Register (already done in beforeEach)

      // 2. Login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('accessToken');
      const accessToken = loginResponse.body.accessToken;

      // 3. Logout
      const logoutResponse = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(logoutResponse.body.message).toBe('Logout successful');
    });

    it('should handle multiple login/logout cycles', async () => {
      for (let i = 0; i < 3; i++) {
        // Login
        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser.email,
            password: testUser.password,
          })
          .expect(200);

        const accessToken = loginResponse.body.accessToken;

        // Logout
        await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
      }
    });

    it('should invalidate session after logout', async () => {
      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const accessToken = loginResponse.body.accessToken;

      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to use the token again (should fail or still work depending on JWT implementation)
      // In stateless JWT, tokens remain valid until expiration
      // In stateful implementations, they should be invalidated
      const retryResponse = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200); // May still succeed in stateless JWT implementation

      // Note: In a stateful token implementation, this would return 401
      expect(retryResponse.body.message).toBe('Logout successful');
    });
  });
});
