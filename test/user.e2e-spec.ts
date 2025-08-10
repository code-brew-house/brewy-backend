import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('User Management (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let accessToken: string;
  let testUserId: string;

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
          contains: 'user-test',
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
          contains: 'user-test',
        },
      },
    });

    // Create a test user and get access token
    const testUser = {
      username: 'testuser',
      email: 'testuser@user-test.com',
      password: 'TestPassword123!',
      fullName: 'Test User',
    };

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    accessToken = registerResponse.body.accessToken;
    testUserId = registerResponse.body.user.id;
  });

  describe('GET /users/profile', () => {
    describe('Successful Profile Access', () => {
      it('should get user profile with valid token', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', testUserId);
        expect(response.body).toHaveProperty('username', 'testuser');
        expect(response.body).toHaveProperty('email', 'testuser@user-test.com');
        expect(response.body).toHaveProperty('fullName', 'Test User');
        expect(response.body).not.toHaveProperty('password');
      });
    });

    describe('Authentication Errors', () => {
      it('should reject profile access without token', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/profile')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
        expect(response.body).toHaveProperty(
          'message',
          'Authentication required',
        );
      });

      it('should reject profile access with invalid token', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });

      it('should reject profile access with malformed token', async () => {
        const malformedTokens = [
          'invalid.token.format',
          'Bearer',
          'Bearer ',
          'Basic ' + accessToken,
          accessToken, // Missing "Bearer "
        ];

        for (const token of malformedTokens) {
          const response = await request(app.getHttpServer())
            .get('/users/profile')
            .set('Authorization', token)
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
        }
      });

      it('should reject profile access after user deletion', async () => {
        // Delete the user
        await prismaService.user.delete({
          where: { id: testUserId },
        });

        const response = await request(app.getHttpServer())
          .get('/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });
    });

    describe('Edge Cases', () => {
      it('should handle requests with extra query parameters', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/profile?extra=param&another=value')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', testUserId);
      });

      it('should handle requests with extra headers', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .set('X-Custom-Header', 'custom-value')
          .set('X-Another-Header', 'another-value')
          .expect(200);

        expect(response.body).toHaveProperty('id', testUserId);
      });

      it('should handle concurrent profile requests', async () => {
        const promises = Array(5)
          .fill(null)
          .map(() =>
            request(app.getHttpServer())
              .get('/users/profile')
              .set('Authorization', `Bearer ${accessToken}`),
          );

        const responses = await Promise.all(promises);

        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('id', testUserId);
        });
      });
    });
  });

  describe('GET /users/:id', () => {
    describe('Successful User Access', () => {
      it('should get user by ID with valid token', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/${testUserId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', testUserId);
        expect(response.body).toHaveProperty('username', 'testuser');
        expect(response.body).toHaveProperty('email', 'testuser@user-test.com');
        expect(response.body).toHaveProperty('fullName', 'Test User');
        expect(response.body).not.toHaveProperty('password');
      });
    });

    describe('Authentication Errors', () => {
      it('should reject user access without token', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/${testUserId}`)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
        expect(response.body).toHaveProperty(
          'message',
          'Authentication required',
        );
      });

      it('should reject user access with invalid token', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/${testUserId}`)
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });
    });

    describe('User Not Found Errors', () => {
      it('should return 404 for non-existent user ID', async () => {
        const nonExistentId = '12345678-1234-1234-1234-123456789012';

        const response = await request(app.getHttpServer())
          .get(`/users/${nonExistentId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Not Found');
      });

      it('should return 400 for invalid UUID format', async () => {
        const invalidIds = [
          'invalid-uuid',
          '123',
          'not-a-uuid',
          '12345678-1234-1234-1234-12345678901', // Too short
          '12345678-1234-1234-1234-1234567890123', // Too long
          '12345678-1234-1234-1234-12345678901g', // Invalid character
        ];

        for (const invalidId of invalidIds) {
          const response = await request(app.getHttpServer())
            .get(`/users/${invalidId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should handle SQL injection attempts in user ID', async () => {
        const sqlInjectionAttempts = [
          "'; DROP TABLE users; --",
          "' OR '1'='1' --",
          "' UNION SELECT * FROM users --",
          "1' OR '1'='1",
        ];

        for (const maliciousId of sqlInjectionAttempts) {
          const response = await request(app.getHttpServer())
            .get(`/users/${encodeURIComponent(maliciousId)}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should handle special characters in user ID', async () => {
        const specialCharacterIds = [
          'user%20id',
          'user\nid',
          'user\tid',
          'user\rid',
          'user\x00id',
          'user<script>alert(1)</script>',
        ];

        for (const specialId of specialCharacterIds) {
          const response = await request(app.getHttpServer())
            .get(`/users/${encodeURIComponent(specialId)}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });
    });

    describe('Edge Cases', () => {
      it('should handle very long user ID parameter', async () => {
        const veryLongId = 'a'.repeat(1000);

        const response = await request(app.getHttpServer())
          .get(`/users/${veryLongId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });

      it('should handle empty user ID parameter', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Not Found');
      });

      it('should handle user ID with URL encoding', async () => {
        const encodedId = encodeURIComponent(testUserId);

        const response = await request(app.getHttpServer())
          .get(`/users/${encodedId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', testUserId);
      });
    });
  });

  describe('HTTP Method Errors', () => {
    it('should reject unsupported HTTP methods on user endpoints', async () => {
      const unsupportedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of unsupportedMethods) {
        let response: any;

        switch (method.toLowerCase()) {
          case 'post':
            response = await request(app.getHttpServer())
              .post('/users/profile')
              .set('Authorization', `Bearer ${accessToken}`)
              .expect(405);
            break;
          case 'put':
            response = await request(app.getHttpServer())
              .put('/users/profile')
              .set('Authorization', `Bearer ${accessToken}`)
              .expect(405);
            break;
          case 'delete':
            response = await request(app.getHttpServer())
              .delete('/users/profile')
              .set('Authorization', `Bearer ${accessToken}`)
              .expect(405);
            break;
          case 'patch':
            response = await request(app.getHttpServer())
              .patch('/users/profile')
              .set('Authorization', `Bearer ${accessToken}`)
              .expect(405);
            break;
        }

        expect(response.body).toHaveProperty('error', 'Method Not Allowed');
      }
    });

    it('should reject unsupported HTTP methods on user by ID endpoints', async () => {
      const unsupportedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of unsupportedMethods) {
        let response: any;

        switch (method.toLowerCase()) {
          case 'post':
            response = await request(app.getHttpServer())
              .post(`/users/${testUserId}`)
              .set('Authorization', `Bearer ${accessToken}`)
              .expect(405);
            break;
          case 'put':
            response = await request(app.getHttpServer())
              .put(`/users/${testUserId}`)
              .set('Authorization', `Bearer ${accessToken}`)
              .expect(405);
            break;
          case 'delete':
            response = await request(app.getHttpServer())
              .delete(`/users/${testUserId}`)
              .set('Authorization', `Bearer ${accessToken}`)
              .expect(405);
            break;
          case 'patch':
            response = await request(app.getHttpServer())
              .patch(`/users/${testUserId}`)
              .set('Authorization', `Bearer ${accessToken}`)
              .expect(405);
            break;
        }

        expect(response.body).toHaveProperty('error', 'Method Not Allowed');
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in user profile response', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers).toHaveProperty('x-api-version');
      expect(response.headers).toHaveProperty(
        'x-permitted-cross-domain-policies',
      );
      expect(response.headers).toHaveProperty('referrer-policy');
      expect(response.headers).toHaveProperty('permissions-policy');
    });

    it('should include security headers in user by ID response', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers).toHaveProperty('x-api-version');
      expect(response.headers).toHaveProperty(
        'x-permitted-cross-domain-policies',
      );
      expect(response.headers).toHaveProperty('referrer-policy');
      expect(response.headers).toHaveProperty('permissions-policy');
    });
  });

  describe('Performance', () => {
    it('should respond to profile requests within acceptable time', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should be under 1 second
    });

    it('should respond to user by ID requests within acceptable time', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should be under 1 second
    });

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      const promises = Array(10)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get('/users/profile')
            .set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.all(promises);
      const responseTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Total time should be reasonable for concurrent requests
      expect(responseTime).toBeLessThan(5000); // Should be under 5 seconds
    });
  });

  describe('Data Integrity', () => {
    it('should not expose sensitive information in user responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should not contain password or other sensitive fields
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('salt');
      expect(response.body).not.toHaveProperty('failedAttempts');
      expect(response.body).not.toHaveProperty('lockedUntil');
      expect(response.body).not.toHaveProperty('lastFailedLogin');
    });

    it('should return consistent data structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify expected structure
      expect(Object.keys(response.body).sort()).toEqual(
        [
          'id',
          'username',
          'email',
          'fullName',
          'createdAt',
          'updatedAt',
        ].sort(),
      );

      // Verify data types
      expect(typeof response.body.id).toBe('string');
      expect(typeof response.body.username).toBe('string');
      expect(typeof response.body.email).toBe('string');
      expect(typeof response.body.fullName).toBe('string');
      expect(typeof response.body.createdAt).toBe('string');
      expect(typeof response.body.updatedAt).toBe('string');
    });
  });
});
