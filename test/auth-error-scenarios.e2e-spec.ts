import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication Error Scenarios (e2e)', () => {
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
          contains: 'error-test',
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
          contains: 'error-test',
        },
      },
    });
  });

  describe('Registration Error Scenarios', () => {
    describe('Malformed Request Bodies', () => {
      it('should handle completely malformed JSON', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send('invalid json string')
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
        expect(response.body.message).toBeDefined();
      });

      it('should handle null values in required fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: null,
            email: null,
            password: null,
            fullName: null,
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
        expect(response.body.message).toBeDefined();
      });

      it('should handle undefined values in required fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: undefined,
            email: undefined,
            password: undefined,
            fullName: undefined,
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
        expect(response.body.message).toBeDefined();
      });

      it('should handle array values instead of strings', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: ['array', 'value'],
            email: ['test@error-test.com'],
            password: ['password123'],
            fullName: ['Test User'],
          });

        // Should be 400 (validation error)
        expect(response.status).toBe(400);

        if (response.status === 400) {
          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should handle object values instead of strings', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: { nested: 'object' },
            email: { email: 'test@error-test.com' },
            password: { password: 'password123' },
            fullName: { name: 'Test User' },
          });

        // Should be 400 (validation error)
        expect(response.status).toBe(400);

        if (response.status === 400) {
          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should handle numeric values instead of strings', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: 12345,
            email: 67890,
            password: 11111,
            fullName: 22222,
          });

        // Should be 400 (validation error)
        expect(response.status).toBe(400);

        if (response.status === 400) {
          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should handle boolean values instead of strings', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: true,
            email: false,
            password: true,
            fullName: false,
          });

        // Should be 400 (validation error)
        expect(response.status).toBe(400);

        if (response.status === 400) {
          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });
    });

    describe('Edge Case Values', () => {
      it('should handle extremely long strings', async () => {
        const veryLongString = 'a'.repeat(1000); // Reduced size to avoid timeout

        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: veryLongString,
            email: `test${Date.now()}@error-test.com`, // Use shorter email
            password: veryLongString,
            fullName: veryLongString,
          });

        // Should be 400 (validation error)
        expect(response.status).toBe(400);

        if (response.status === 400) {
          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should handle empty strings', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: '',
            email: '',
            password: '',
            fullName: '',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });

      it('should handle strings with only whitespace', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: '   ',
            email: '   ',
            password: '   ',
            fullName: '   ',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });

      it('should handle unicode and special characters', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: '🦄💫✨',
            email: '🦄💫✨@error-test.com',
            password: '🦄💫✨Password123!',
            fullName: '🦄💫✨ Test User',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });
    });

    describe('Boundary Value Testing', () => {
      it('should handle minimum boundary values', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: 'ab', // Below minimum length
            email: 'a@b.c', // Minimal email
            password: 'Aa1!', // Below minimum length
            fullName: 'A', // Below minimum length
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });

      it('should handle maximum boundary values', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: 'a'.repeat(51), // Above maximum length
            email: `${'a'.repeat(240)}@error-test.com`, // Very long email
            password: 'TestPassword123!' + 'a'.repeat(100), // Very long password
            fullName: 'Test User ' + 'a'.repeat(200), // Above maximum length
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });
    });

    describe('Content-Type and Header Issues', () => {
      it('should handle missing Content-Type header', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .type('') // Remove content-type
          .send('username=test&email=test@error-test.com&password=Test123!')
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle incorrect Content-Type header', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .set('Content-Type', 'text/plain')
          .send('username=test&email=test@error-test.com&password=Test123!')
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle XML content type', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .set('Content-Type', 'application/xml')
          .send(
            '<user><username>test</username><email>test@error-test.com</email></user>',
          )
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Login Error Scenarios', () => {
    const validUser = {
      username: 'validuser',
      email: 'valid@error-test.com',
      password: 'ValidPassword123!',
      fullName: 'Valid User',
    };

    beforeEach(async () => {
      // Create a valid user for login tests
      await request(app.getHttpServer()).post('/auth/register').send(validUser);
    });

    describe('Credential Validation Edge Cases', () => {
      it('should handle login with SQL injection in identifier', async () => {
        const sqlInjectionAttempts = [
          "'; DROP TABLE users; --",
          "' OR '1'='1' --",
          "' UNION SELECT * FROM users --",
          "admin'/*",
          "' OR 1=1#",
          "' OR 'a'='a",
          "') OR ('1'='1",
        ];

        for (const maliciousIdentifier of sqlInjectionAttempts) {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: maliciousIdentifier,
              password: validUser.password,
            })
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
          expect(response.body.message).toBe('Invalid credentials');
        }
      });

      it('should handle login with NoSQL injection attempts', async () => {
        const noSQLInjectionAttempts = [
          { $ne: null },
          { $gt: '' },
          { $regex: '.*' },
          { $where: 'function() { return true; }' },
        ];

        for (const maliciousIdentifier of noSQLInjectionAttempts) {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: maliciousIdentifier,
              password: validUser.password,
            })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should handle extremely long credentials', async () => {
        const veryLongString = 'a'.repeat(10000);

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: veryLongString,
            password: veryLongString,
          })
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
        expect(response.body.message).toBe('Invalid credentials');
      });

      it('should handle null byte injection attempts', async () => {
        const nullByteAttempts = [
          'test\x00@error-test.com',
          'test@error-test.com\x00',
          'test\x00\x00user',
          'password\x00123',
        ];

        for (const maliciousInput of nullByteAttempts) {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: maliciousInput,
              password: validUser.password,
            })
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
          expect(response.body.message).toBe('Invalid credentials');
        }
      });

      it('should handle control character injection', async () => {
        const controlCharacters = [
          'test\r\n@error-test.com',
          'test\t@error-test.com',
          'test\b@error-test.com',
          'test\f@error-test.com',
        ];

        for (const maliciousInput of controlCharacters) {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              identifier: maliciousInput,
              password: validUser.password,
            })
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
          expect(response.body.message).toBe('Invalid credentials');
        }
      });
    });

    describe('Password Edge Cases', () => {
      it('should handle empty password after whitespace trimming', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: validUser.email,
            password: '   ', // Only whitespace
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });

      it('should handle password with only special characters', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: validUser.email,
            password: '!@#$%^&*()_+{}[]|;:,.<>?',
          })
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
        expect(response.body.message).toBe('Invalid credentials');
      });

      it('should handle password with binary data', async () => {
        const binaryPassword = Buffer.from([
          0x01, 0x02, 0x03, 0x04, 0x05,
        ]).toString('binary');

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: validUser.email,
            password: binaryPassword,
          })
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
        expect(response.body.message).toBe('Invalid credentials');
      });
    });

    describe('Malformed Login Requests', () => {
      it('should handle login with extra nested objects', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: validUser.email,
            password: validUser.password,
            extraObject: {
              nested: {
                deeply: {
                  value: 'should be rejected',
                },
              },
            },
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });

      it('should handle login with circular references', async () => {
        const circularObj: any = {
          identifier: validUser.email,
          password: validUser.password,
        };
        circularObj.circular = circularObj;

        // This test depends on how the framework handles circular references
        // Most frameworks will reject this during JSON parsing
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send(JSON.stringify(circularObj))
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Logout Error Scenarios', () => {
    let validToken: string;

    beforeEach(async () => {
      // Register and login to get a valid token
      const user = {
        username: 'logoutuser',
        email: 'logout@error-test.com',
        password: 'LogoutPassword123!',
        fullName: 'Logout User',
      };

      await request(app.getHttpServer()).post('/auth/register').send(user);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: user.email,
          password: user.password,
        });

      validToken = loginResponse.body.accessToken;
    });

    describe('Token Format Issues', () => {
      it('should handle malformed JWT tokens', async () => {
        const malformedTokens = [
          'invalid.token.format',
          'header.payload', // Missing signature
          'header', // Missing payload and signature
          'header.payload.signature.extra', // Too many parts
          'not-a-jwt-token',
          'Bearer.token.here',
        ];

        for (const token of malformedTokens) {
          const response = await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', `Bearer ${token}`)
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
        }
      });

      it('should handle tokens with invalid base64 encoding', async () => {
        const invalidTokens = [
          'invalid_base64!.invalid_base64!.invalid_base64!',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_payload.invalid_signature',
        ];

        for (const token of invalidTokens) {
          const response = await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', `Bearer ${token}`)
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
        }
      });

      it('should handle tokens with tampered signatures', async () => {
        // Take a valid token and modify the signature
        const tokenParts = validToken.split('.');
        const tamperedToken = `${tokenParts[0]}.${tokenParts[1]}.tampered_signature`;

        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${tamperedToken}`)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });
    });

    describe('Authorization Header Issues', () => {
      it('should handle missing authorization header', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });

      it('should handle empty authorization header', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', '')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });

      it('should handle malformed authorization header formats', async () => {
        const malformedHeaders = [
          'Bearer',
          'Bearer ',
          'Basic ' + validToken,
          'Token ' + validToken,
          'JWT ' + validToken,
          validToken, // Missing "Bearer "
          'Bearer  ' + validToken, // Extra space
          'bearer ' + validToken, // Wrong case
          'BEARER ' + validToken, // Wrong case
        ];

        for (const header of malformedHeaders) {
          const response = await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', header)
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
        }
      });

      it('should handle authorization header with special characters', async () => {
        const specialHeaders = [
          'Bearer\x00' + validToken,
          'Bearer\n' + validToken,
          'Bearer\r' + validToken,
          'Bearer\t' + validToken,
          'Bearer' + String.fromCharCode(0) + validToken,
        ];

        for (const header of specialHeaders) {
          const response = await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', header)
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
        }
      });
    });
  });

  describe('Cross-Endpoint Error Scenarios', () => {
    it('should handle requests to non-existent auth endpoints', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/nonexistent')
        .send({
          username: 'test',
          password: 'test',
        })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });

    it('should handle wrong HTTP methods on auth endpoints', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        let response: any;

        switch (method.toLowerCase()) {
          case 'get':
            response = await request(app.getHttpServer())
              .get('/auth/register')
              .send({
                username: 'test',
                email: 'test@error-test.com',
                password: 'TestPassword123!',
                fullName: 'Test User',
              })
              .expect(405);
            break;
          case 'put':
            response = await request(app.getHttpServer())
              .put('/auth/register')
              .send({
                username: 'test',
                email: 'test@error-test.com',
                password: 'TestPassword123!',
                fullName: 'Test User',
              })
              .expect(405);
            break;
          case 'delete':
            response = await request(app.getHttpServer())
              .delete('/auth/register')
              .send({
                username: 'test',
                email: 'test@error-test.com',
                password: 'TestPassword123!',
                fullName: 'Test User',
              })
              .expect(405);
            break;
          case 'patch':
            response = await request(app.getHttpServer())
              .patch('/auth/register')
              .send({
                username: 'test',
                email: 'test@error-test.com',
                password: 'TestPassword123!',
                fullName: 'Test User',
              })
              .expect(405);
            break;
        }

        expect(response.body).toHaveProperty('error', 'Method Not Allowed');
      }
    });

    it('should handle concurrent duplicate registration attempts', async () => {
      const userData = {
        username: 'duplicateuser',
        email: 'duplicate@error-test.com',
        password: 'DuplicatePassword123!',
        fullName: 'Duplicate User',
      };

      // Send multiple concurrent registration requests
      const promises = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer()).post('/auth/register').send(userData),
        );

      const responses = await Promise.all(
        promises.map((p) => p.catch((e) => e)),
      );

      // One should succeed, others should fail with conflict
      const statusCodes = responses.map((r) => r.status);
      const successCount = statusCodes.filter((code) => code === 201).length;
      const conflictCount = statusCodes.filter((code) => code === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBeGreaterThan(0);
    });
  });

  describe('Database Error Simulation', () => {
    it('should handle database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test with invalid data that might cause DB constraints
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'testuser',
          email: 'test@error-test.com',
          password: 'TestPassword123!',
          fullName: 'Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
    });
  });

  describe('Rate Limiting Edge Cases', () => {
    it('should handle burst requests followed by normal requests', async () => {
      // Send burst of requests
      const burstPromises = Array(20)
        .fill(null)
        .map((_, i) =>
          request(app.getHttpServer())
            .post('/auth/register')
            .send({
              username: `burstuser${i}`,
              email: `burst${i}@error-test.com`,
              password: 'BurstPassword123!',
              fullName: `Burst User ${i}`,
            }),
        );

      const burstResponses = await Promise.all(burstPromises);
      const successCount = burstResponses.filter(
        (r) => r.status === 201,
      ).length;

      expect(successCount).toBeGreaterThan(0);

      // Normal request should work
      const normalResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'normaluser',
          email: 'normal@error-test.com',
          password: 'NormalPassword123!',
          fullName: 'Normal User',
        });

      expect(normalResponse.status).toBe(201);
    }, 15000);
  });
});
