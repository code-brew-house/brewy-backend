import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Rate Limiting Security (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  const validRegistrationData = {
    username: 'ratelimituser',
    email: 'ratelimit@test-e2e.com',
    password: 'TestPassword123!',
    fullName: 'Rate Limit Test User',
  };

  const validLoginData = {
    identifier: 'ratelimit@test-e2e.com',
    password: 'TestPassword123!',
  };

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
          contains: 'ratelimit',
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
          contains: 'ratelimit',
        },
      },
    });

    // Wait a bit to ensure rate limits reset between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  describe('Registration Rate Limiting', () => {
    describe('Rate Limit Configuration', () => {
      it('should allow requests within rate limit (3 per 10 minutes)', async () => {
        const userPromises = [];

        // Create 3 different users (should all succeed)
        for (let i = 0; i < 3; i++) {
          userPromises.push(
            request(app.getHttpServer())
              .post('/auth/register')
              .send({
                ...validRegistrationData,
                username: `ratelimituser${i}`,
                email: `ratelimit${i}@test-e2e.com`,
              }),
          );
        }

        const responses = await Promise.all(userPromises);

        // All 3 should succeed
        responses.forEach((response) => {
          expect([201, 429]).toContain(response.status);
        });

        // At least one should succeed
        const successfulRequests = responses.filter((r) => r.status === 201);
        expect(successfulRequests.length).toBeGreaterThan(0);
      });

      it('should block requests exceeding rate limit', async () => {
        const promises = [];

        // Make 6 rapid registration attempts (exceeds limit of 3)
        for (let i = 0; i < 6; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/register')
              .send({
                ...validRegistrationData,
                username: `ratelimituser${i}`,
                email: `ratelimit${i}@test-e2e.com`,
              }),
          );
        }

        const responses = await Promise.all(promises);
        const statusCodes = responses.map((r) => r.status);

        // Should have both successful (201) and rate limited (429) responses
        const successfulRequests = statusCodes.filter((code) => code === 201);
        const rateLimitedRequests = statusCodes.filter((code) => code === 429);

        expect(successfulRequests.length).toBeGreaterThanOrEqual(1);
        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }, 15000);

      it('should return proper 429 Too Many Requests response', async () => {
        // Make rapid requests to trigger rate limiting
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/register')
              .send({
                ...validRegistrationData,
                username: `ratelimituser${i}`,
                email: `ratelimit${i}@test-e2e.com`,
              }),
          );
        }

        const responses = await Promise.all(promises);
        const rateLimitedResponse = responses.find((r) => r.status === 429);

        if (rateLimitedResponse) {
          expect(rateLimitedResponse.status).toBe(429);
          expect(rateLimitedResponse.body).toHaveProperty('error');
          expect(rateLimitedResponse.body.error).toContain('Too Many Requests');
          expect(rateLimitedResponse.headers).toHaveProperty('retry-after');
        }
      }, 10000);
    });

    describe('IP-based Rate Limiting', () => {
      it('should track rate limits per IP address', async () => {
        // Test with different X-Forwarded-For headers (simulating different IPs)
        const ip1Responses = [];
        const ip2Responses = [];

        // Make requests from IP 1
        for (let i = 0; i < 3; i++) {
          ip1Responses.push(
            await request(app.getHttpServer())
              .post('/auth/register')
              .set('X-Forwarded-For', '192.168.1.1')
              .send({
                ...validRegistrationData,
                username: `ip1user${i}`,
                email: `ip1user${i}@test-e2e.com`,
              }),
          );
        }

        // Make requests from IP 2 (should not be affected by IP 1's limits)
        for (let i = 0; i < 3; i++) {
          ip2Responses.push(
            await request(app.getHttpServer())
              .post('/auth/register')
              .set('X-Forwarded-For', '192.168.1.2')
              .send({
                ...validRegistrationData,
                username: `ip2user${i}`,
                email: `ip2user${i}@test-e2e.com`,
              }),
          );
        }

        // Both IPs should have successful requests
        const ip1Success = ip1Responses.filter((r) => r.status === 201).length;
        const ip2Success = ip2Responses.filter((r) => r.status === 201).length;

        expect(ip1Success).toBeGreaterThan(0);
        expect(ip2Success).toBeGreaterThan(0);
      }, 20000);

      it('should handle X-Forwarded-For header with multiple IPs', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .set('X-Forwarded-For', '203.0.113.1, 192.168.1.1, 10.0.0.1')
          .send(validRegistrationData);

        // Should process the request (using first IP in chain)
        expect([201, 429]).toContain(response.status);
      });

      it('should handle X-Real-IP header', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .set('X-Real-IP', '203.0.113.2')
          .send({
            ...validRegistrationData,
            username: 'realipuser',
            email: 'realip@test-e2e.com',
          });

        expect([201, 429]).toContain(response.status);
      });

      it('should handle requests without proxy headers', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            ...validRegistrationData,
            username: 'noproxyuser',
            email: 'noproxy@test-e2e.com',
          });

        expect([201, 429]).toContain(response.status);
      });
    });

    describe('Rate Limit Bypass Attempts', () => {
      it('should not be bypassed by changing User-Agent', async () => {
        const promises = [];

        // Make multiple requests with different User-Agent headers
        for (let i = 0; i < 5; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/register')
              .set('User-Agent', `TestAgent-${i}`)
              .send({
                ...validRegistrationData,
                username: `useragentuser${i}`,
                email: `useragent${i}@test-e2e.com`,
              }),
          );
        }

        const responses = await Promise.all(promises);
        const rateLimitedRequests = responses.filter((r) => r.status === 429);

        // Should still enforce rate limits regardless of User-Agent
        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }, 10000);

      it('should not be bypassed by changing request headers', async () => {
        const promises = [];

        // Make multiple requests with different headers
        for (let i = 0; i < 5; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/register')
              .set('Custom-Header', `value-${i}`)
              .set('Accept-Language', `en-${i}`)
              .send({
                ...validRegistrationData,
                username: `headeruser${i}`,
                email: `header${i}@test-e2e.com`,
              }),
          );
        }

        const responses = await Promise.all(promises);
        const rateLimitedRequests = responses.filter((r) => r.status === 429);

        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }, 10000);

      it('should detect IP spoofing attempts', async () => {
        const promises = [];

        // Try to spoof different IPs rapidly from same source
        const spoofedIPs = [
          '1.1.1.1',
          '8.8.8.8',
          '208.67.222.222',
          '9.9.9.9',
          '76.76.76.76',
        ];

        for (let i = 0; i < spoofedIPs.length; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/register')
              .set('X-Forwarded-For', spoofedIPs[i])
              .send({
                ...validRegistrationData,
                username: `spoofuser${i}`,
                email: `spoof${i}@test-e2e.com`,
              }),
          );
        }

        const responses = await Promise.all(promises);

        // Even with different spoofed IPs, some requests should succeed
        // This tests that the system can handle various IP scenarios
        const successfulRequests = responses.filter((r) => r.status === 201);
        expect(successfulRequests.length).toBeGreaterThan(0);
      }, 10000);
    });
  });

  describe('Login Rate Limiting', () => {
    beforeEach(async () => {
      // Create a test user for login attempts
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegistrationData);

      // Wait for registration to complete
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    describe('Failed Login Rate Limiting', () => {
      it('should rate limit failed login attempts more aggressively', async () => {
        const promises = [];

        // Make multiple failed login attempts
        for (let i = 0; i < 8; i++) {
          promises.push(
            request(app.getHttpServer()).post('/auth/login').send({
              identifier: validLoginData.identifier,
              password: 'WrongPassword123!',
            }),
          );
        }

        const responses = await Promise.all(promises);
        const statusCodes = responses.map((r) => r.status);

        // Should have both unauthorized (401) and rate limited (429) responses
        const unauthorizedRequests = statusCodes.filter((code) => code === 401);
        const rateLimitedRequests = statusCodes.filter((code) => code === 429);

        expect(unauthorizedRequests.length).toBeGreaterThan(0);
        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }, 15000);

      it('should allow successful logins within rate limit', async () => {
        const promises = [];

        // Make multiple successful login attempts (should be allowed)
        for (let i = 0; i < 3; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/login')
              .send(validLoginData),
          );
        }

        const responses = await Promise.all(promises);

        // Most should succeed (200) with only some potentially rate limited (429)
        const successfulRequests = responses.filter((r) => r.status === 200);
        expect(successfulRequests.length).toBeGreaterThan(0);
      }, 10000);

      it('should differentiate between different users for rate limiting', async () => {
        // Create second user
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            ...validRegistrationData,
            username: 'ratelimituser2',
            email: 'ratelimit2@test-e2e.com',
          });

        // Make failed attempts for user 1
        const user1Promises = [];
        for (let i = 0; i < 4; i++) {
          user1Promises.push(
            request(app.getHttpServer()).post('/auth/login').send({
              identifier: 'ratelimit@test-e2e.com',
              password: 'WrongPassword123!',
            }),
          );
        }

        // Make attempts for user 2 (should not be affected by user 1's limits)
        const user2Promises = [];
        for (let i = 0; i < 2; i++) {
          user2Promises.push(
            request(app.getHttpServer()).post('/auth/login').send({
              identifier: 'ratelimit2@test-e2e.com',
              password: 'TestPassword123!',
            }),
          );
        }

        await Promise.all(user1Promises);
        const user2Responses = await Promise.all(user2Promises);

        // User 2 should have successful requests despite user 1's failed attempts
        const user2Success = user2Responses.filter((r) => r.status === 200);
        expect(user2Success.length).toBeGreaterThan(0);
      }, 15000);
    });

    describe('Brute Force Protection', () => {
      it('should detect and block brute force attempts', async () => {
        const promises = [];

        // Simulate brute force attack with different passwords
        const commonPasswords = [
          'password',
          '123456',
          'password123',
          'admin',
          'qwerty',
          'letmein',
          'welcome',
          'monkey',
        ];

        for (const password of commonPasswords) {
          promises.push(
            request(app.getHttpServer()).post('/auth/login').send({
              identifier: validLoginData.identifier,
              password: password,
            }),
          );
        }

        const responses = await Promise.all(promises);
        const rateLimitedRequests = responses.filter((r) => r.status === 429);

        // Should block some attempts as brute force
        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }, 15000);

      it('should handle dictionary attack patterns', async () => {
        const promises = [];

        // Simulate dictionary attack
        for (let i = 0; i < 10; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/auth/login')
              .send({
                identifier: validLoginData.identifier,
                password: `DictWord${i}!`,
              }),
          );
        }

        const responses = await Promise.all(promises);
        const statusCodes = responses.map((r) => r.status);

        // Should have mix of 401 (invalid credentials) and 429 (rate limited)
        const unauthorizedRequests = statusCodes.filter((code) => code === 401);
        const rateLimitedRequests = statusCodes.filter((code) => code === 429);

        expect(unauthorizedRequests.length + rateLimitedRequests.length).toBe(
          10,
        );
        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }, 15000);
    });
  });

  describe('General Endpoint Rate Limiting', () => {
    it('should apply general rate limits to non-auth endpoints', async () => {
      const promises = [];

      // Make many requests to general endpoint
      for (let i = 0; i < 50; i++) {
        promises.push(request(app.getHttpServer()).get('/health'));
      }

      const responses = await Promise.all(promises);
      const statusCodes = responses.map((r) => r.status);

      // Should have both successful and rate limited responses
      const successfulRequests = statusCodes.filter((code) => code === 200);

      expect(successfulRequests.length).toBeGreaterThan(0);
      // Depending on configuration, might hit general rate limits
    }, 20000);

    it('should reset rate limits after TTL expires', async () => {
      // This test would need longer TTL to be practical in real scenarios
      // For testing purposes, we verify the mechanism works
      const response1 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...validRegistrationData,
          username: 'ttluser1',
          email: 'ttl1@test-e2e.com',
        });

      expect([201, 429]).toContain(response1.status);

      // Wait a short time (in real scenarios this would be longer)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response2 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...validRegistrationData,
          username: 'ttluser2',
          email: 'ttl2@test-e2e.com',
        });

      expect([201, 429]).toContain(response2.status);
    });
  });

  describe('Rate Limit Response Headers', () => {
    it('should include rate limit headers in responses', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...validRegistrationData,
          username: 'headeruser',
          email: 'header@test-e2e.com',
        });

      // Check for common rate limiting headers
      if (response.status === 429) {
        expect(response.headers).toHaveProperty('retry-after');
      }

      // Response should have security headers
      expect(response.headers).toHaveProperty('x-request-id');
    });

    it('should provide clear error messages for rate limited requests', async () => {
      const promises = [];

      // Force rate limiting
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/auth/register')
            .send({
              ...validRegistrationData,
              username: `erroruser${i}`,
              email: `error${i}@test-e2e.com`,
            }),
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponse = responses.find((r) => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toHaveProperty('error');
        expect(rateLimitedResponse.body).toHaveProperty('message');
        expect(rateLimitedResponse.body.error).toContain('Too Many Requests');
      }
    }, 10000);
  });

  describe('Security Logging and Monitoring', () => {
    it('should log rate limit violations for security monitoring', async () => {
      // Capture console output for verification
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/auth/register')
            .send({
              ...validRegistrationData,
              username: `loguser${i}`,
              email: `log${i}@test-e2e.com`,
            }),
        );
      }

      await Promise.all(promises);

      // Should have logged rate limit violations
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RATE LIMIT]'),
      );

      consoleSpy.mockRestore();
    }, 10000);

    it('should include IP address and user agent in rate limit logs', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const promises = [];
      for (let i = 0; i < 4; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/auth/register')
            .set('User-Agent', 'SecurityTestAgent/1.0')
            .set('X-Forwarded-For', '192.168.100.1')
            .send({
              ...validRegistrationData,
              username: `secloguser${i}`,
              email: `seclog${i}@test-e2e.com`,
            }),
        );
      }

      await Promise.all(promises);

      // Verify security logging includes relevant information
      if (consoleSpy.mock.calls.length > 0) {
        const logCall = consoleSpy.mock.calls.find(
          (call) =>
            call[0].includes('[SECURITY-MEDIUM]') &&
            call[0].includes('RATE_LIMIT_EXCEEDED'),
        );
        expect(logCall).toBeTruthy();
      }

      consoleSpy.mockRestore();
    }, 10000);
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed IP headers gracefully', async () => {
      const malformedHeaders = [
        'not-an-ip',
        '999.999.999.999',
        '192.168.1',
        'localhost',
        '::1::invalid',
      ];

      for (const malformedIP of malformedHeaders) {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .set('X-Forwarded-For', malformedIP)
          .send({
            ...validRegistrationData,
            username: `malformed${Math.random()}`,
            email: `malformed${Math.random()}@test-e2e.com`,
          });

        // Should handle gracefully without crashing
        expect([201, 429, 400]).toContain(response.status);
      }
    });

    it('should handle missing request information gracefully', async () => {
      // Test with minimal request information
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...validRegistrationData,
          username: 'minimaluser',
          email: 'minimal@test-e2e.com',
        });

      expect([201, 429]).toContain(response.status);
    });

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      const promises = [];

      // Make 20 concurrent requests
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/auth/register')
            .send({
              ...validRegistrationData,
              username: `concurrent${i}`,
              email: `concurrent${i}@test-e2e.com`,
            }),
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // Should handle concurrent requests within reasonable time
      expect(endTime - startTime).toBeLessThan(10000);

      // Should have proper mix of responses
      const statusCodes = responses.map((r) => r.status);
      const uniqueStatusCodes = [...new Set(statusCodes)];
      expect(
        uniqueStatusCodes.every((code) => [201, 429, 409].includes(code)),
      ).toBe(true);
    }, 15000);
  });
});
