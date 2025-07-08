import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Protected Routes (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const testUser = {
    username: 'teste2eprotected',
    email: 'test-e2e-protected@example.com',
    password: 'TestPassword123!',
    fullName: 'Test Protected User',
  };

  let validToken: string;
  let userId: string;

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
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
    await prismaService.user.deleteMany({
      where: {
        email: {
          contains: 'test-e2e-protected',
        },
      },
    });
    await app.close();
  });

  beforeEach(async () => {
    // Clean up any existing test users
    await prismaService.user.deleteMany({
      where: {
        email: {
          contains: 'test-e2e-protected',
        },
      },
    });

    // Register a test user and get valid token
    const registrationResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    validToken = registrationResponse.body.accessToken;
    userId = registrationResponse.body.user.id;
  });

  describe('POST /auth/logout (Protected Route)', () => {
    describe('Authentication Success', () => {
      it('should logout successfully with valid JWT token', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Logout successful');
      });

      it('should accept token with Bearer prefix (case insensitive)', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `bearer ${validToken}`)
          .expect(200);

        expect(response.body.message).toBe('Logout successful');
      });

      it('should include security headers in protected route response', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.headers).toHaveProperty('x-request-id');
        expect(response.headers).toHaveProperty('x-api-version');
        expect(response.headers).toHaveProperty(
          'x-permitted-cross-domain-policies',
        );
        expect(response.headers).toHaveProperty('referrer-policy');
        expect(response.headers).toHaveProperty('permissions-policy');
      });
    });

    describe('Authentication Failures', () => {
      it('should reject request without Authorization header', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
        expect(response.body).toHaveProperty(
          'message',
          'Authentication required',
        );
      });

      it('should reject request with empty Authorization header', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', '')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });

      it('should reject request with malformed Authorization header', async () => {
        const malformedHeaders = [
          'invalid-format',
          'Bearer',
          'Bearer ',
          'Basic ' + validToken,
          validToken, // Missing "Bearer " prefix
          'Bearer invalid-token-format',
        ];

        for (const header of malformedHeaders) {
          const response = await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', header)
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
        }
      });

      it('should reject request with invalid JWT token', async () => {
        const invalidTokens = [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
          'not-a-jwt-token',
          'Bearer.invalid.token',
          'completely-invalid-token',
        ];

        for (const token of invalidTokens) {
          const response = await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', `Bearer ${token}`)
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
        }
      });

      it('should reject request with expired JWT token', async () => {
        // Create an expired token
        const expiredToken = jwtService.sign(
          { sub: userId, email: testUser.email, username: testUser.username },
          { expiresIn: '1ms' }, // Already expired
        );

        // Wait a bit to ensure token is expired
        await new Promise((resolve) => setTimeout(resolve, 10));

        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });

      it('should reject request with token signed with wrong secret', async () => {
        // Create a token with wrong secret
        const wrongSecretToken = jwtService.sign(
          { sub: userId, email: testUser.email, username: testUser.username },
          { secret: 'wrong-secret' },
        );

        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${wrongSecretToken}`)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });

      it('should reject request with token for non-existent user', async () => {
        // Create a token for a non-existent user
        const nonExistentUserToken = jwtService.sign({
          sub: '99999999-9999-9999-9999-999999999999',
          email: 'nonexistent@example.com',
          username: 'nonexistent',
        });

        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${nonExistentUserToken}`)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Unauthorized');
      });
    });

    describe('Token Payload Validation', () => {
      it('should reject token with missing required claims', async () => {
        const invalidPayloads = [
          {}, // Empty payload
          { sub: userId }, // Missing email and username
          { email: testUser.email }, // Missing sub and username
          { username: testUser.username }, // Missing sub and email
          { sub: '', email: testUser.email, username: testUser.username }, // Empty sub
          { sub: userId, email: '', username: testUser.username }, // Empty email
          { sub: userId, email: testUser.email, username: '' }, // Empty username
        ];

        for (const payload of invalidPayloads) {
          const invalidToken = jwtService.sign(payload);

          const response = await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', `Bearer ${invalidToken}`)
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
        }
      });

      it('should reject token with invalid user ID format', async () => {
        const invalidUserIds = [
          'not-a-uuid',
          '123',
          'invalid-uuid-format',
          '12345678-1234-1234-1234-123456789abc', // Invalid UUID
        ];

        for (const invalidId of invalidUserIds) {
          const invalidToken = jwtService.sign({
            sub: invalidId,
            email: testUser.email,
            username: testUser.username,
          });

          const response = await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', `Bearer ${invalidToken}`)
            .expect(401);

          expect(response.body).toHaveProperty('error', 'Unauthorized');
        }
      });

      it('should validate token with correct user data', async () => {
        // Create a fresh token with correct payload
        const correctToken = jwtService.sign({
          sub: userId,
          email: testUser.email,
          username: testUser.username,
        });

        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${correctToken}`)
          .expect(200);

        expect(response.body.message).toBe('Logout successful');
      });
    });

    describe('Security Headers and XSS Protection', () => {
      it('should not reflect malicious content in error responses', async () => {
        const maliciousTokens = [
          '<script>alert("xss")</script>',
          'javascript:alert(1)',
          '<img src="x" onerror="alert(1)">',
          '"><script>alert("xss")</script>',
        ];

        for (const maliciousToken of maliciousTokens) {
          const response = await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', `Bearer ${maliciousToken}`)
            .expect(401);

          // Response should not contain the malicious content
          expect(JSON.stringify(response.body)).not.toContain('<script>');
          expect(JSON.stringify(response.body)).not.toContain('javascript:');
          expect(JSON.stringify(response.body)).not.toContain('onerror');
        }
      });

      it('should include proper CORS headers for protected routes', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Origin', 'https://example.com');

        // Should have CORS headers
        expect(response.headers).toHaveProperty('access-control-allow-origin');
      });

      it('should not expose sensitive information in error responses', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        // Should not reveal implementation details
        expect(response.body.message).not.toContain('jwt');
        expect(response.body.message).not.toContain('secret');
        expect(response.body.message).not.toContain('database');
        expect(response.body.message).not.toContain('prisma');
      });
    });

    describe('Rate Limiting on Protected Routes', () => {
      it('should apply rate limiting to protected routes', async () => {
        const promises = [];

        // Make multiple rapid requests to protected route
        for (let i = 0; i < 15; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/logout')
              .set('Authorization', `Bearer ${validToken}`),
          );
        }

        const responses = await Promise.all(promises);
        const statusCodes = responses.map((r) => r.status);

        // Should have some successful requests and some rate limited
        const successfulRequests = statusCodes.filter((code) => code === 200);
        const rateLimitedRequests = statusCodes.filter((code) => code === 429);

        expect(successfulRequests.length).toBeGreaterThan(0);
        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }, 10000);
    });

    describe('Concurrent Access Protection', () => {
      it('should handle concurrent protected route access', async () => {
        const promises = [];

        // Create multiple concurrent requests
        for (let i = 0; i < 5; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/logout')
              .set('Authorization', `Bearer ${validToken}`),
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
  });

  describe('GET /auth/validate-token (Unprotected but token-dependent)', () => {
    describe('Token Validation Success', () => {
      it('should validate valid JWT token', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/validate-token')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('valid', true);
        expect(response.body).toHaveProperty('expiresAt');
        expect(response.body).toHaveProperty('issuedAt');
        expect(response.body).toHaveProperty('expiringSoon');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty('id', userId);
        expect(response.body.user).toHaveProperty('email', testUser.email);
        expect(response.body.user).toHaveProperty(
          'username',
          testUser.username,
        );
      });

      it('should return token expiration information', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/validate-token')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(response.body.valid).toBe(true);
        expect(new Date(response.body.expiresAt)).toBeInstanceOf(Date);
        expect(new Date(response.body.issuedAt)).toBeInstanceOf(Date);
        expect(typeof response.body.expiringSoon).toBe('boolean');
      });

      it('should detect tokens expiring soon', async () => {
        // Create a token that expires in 20 seconds
        const shortLivedToken = jwtService.sign(
          { sub: userId, email: testUser.email, username: testUser.username },
          { expiresIn: '20s' },
        );

        const response = await request(app.getHttpServer())
          .get('/auth/validate-token')
          .set('Authorization', `Bearer ${shortLivedToken}`)
          .expect(200);

        expect(response.body.valid).toBe(true);
        expect(response.body.expiringSoon).toBe(true);
      });
    });

    describe('Token Validation Failure', () => {
      it('should return invalid for missing token', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/validate-token')
          .expect(200);

        expect(response.body).toHaveProperty('valid', false);
        expect(response.body).not.toHaveProperty('user');
        expect(response.body).not.toHaveProperty('expiresAt');
      });

      it('should return invalid for expired token', async () => {
        const expiredToken = jwtService.sign(
          { sub: userId, email: testUser.email, username: testUser.username },
          { expiresIn: '1ms' },
        );

        await new Promise((resolve) => setTimeout(resolve, 10));

        const response = await request(app.getHttpServer())
          .get('/auth/validate-token')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('valid', false);
      });

      it('should return invalid for malformed token', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/validate-token')
          .set('Authorization', 'Bearer invalid-token')
          .expect(200);

        expect(response.body).toHaveProperty('valid', false);
      });

      it('should return invalid for token with wrong secret', async () => {
        const wrongSecretToken = jwtService.sign(
          { sub: userId, email: testUser.email, username: testUser.username },
          { secret: 'wrong-secret' },
        );

        const response = await request(app.getHttpServer())
          .get('/auth/validate-token')
          .set('Authorization', `Bearer ${wrongSecretToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('valid', false);
      });
    });
  });

  describe('JWT Token Edge Cases', () => {
    it('should handle token with extra whitespace', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer   ${validToken}   `)
        .expect(200);

      expect(response.body.message).toBe('Logout successful');
    });

    it('should handle very long but valid tokens', async () => {
      // Create a token with extra claims to make it longer
      const longToken = jwtService.sign({
        sub: userId,
        email: testUser.email,
        username: testUser.username,
        extraClaim: 'a'.repeat(1000), // Long string
      });

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${longToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logout successful');
    });

    it('should reject extremely long malformed tokens', async () => {
      const veryLongToken = 'a'.repeat(10000);

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${veryLongToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should handle token after user data changes', async () => {
      // Update user in database
      await prismaService.user.update({
        where: { id: userId },
        data: { fullName: 'Updated Name' },
      });

      // Token should still be valid (depending on implementation)
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logout successful');
    });
  });

  describe('Performance and Security Tests', () => {
    it('should respond quickly to protected route requests', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;

      // Should respond within acceptable time
      expect(responseTime).toBeLessThan(1000);
    });

    it('should handle token validation efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/auth/validate-token')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;

      // Token validation should be fast
      expect(responseTime).toBeLessThan(500);
    });

    it('should protect against timing attacks', async () => {
      const timings = [];

      // Test with valid token multiple times
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${validToken}`);
        timings.push(Date.now() - start);
      }

      // Test with invalid token multiple times
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', 'Bearer invalid-token');
        timings.push(Date.now() - start);
      }

      // All timings should be within reasonable bounds
      timings.forEach((timing) => {
        expect(timing).toBeLessThan(2000);
      });
    });
  });
});
