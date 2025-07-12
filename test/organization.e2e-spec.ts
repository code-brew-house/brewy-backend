import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Organization Management (e2e)', () => {
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
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up any existing test data before each test
    await cleanupTestData();
  });

  const cleanupTestData = async () => {
    await prismaService.user.deleteMany({
      where: {
        email: {
          contains: 'org-test',
        },
      },
    });
    await prismaService.organization.deleteMany({
      where: {
        email: {
          contains: 'org-test',
        },
      },
    });
  };

  describe('POST /organizations', () => {
    const validOrganizationData = {
      name: 'Test Organization',
      email: 'test@org-test.com',
      contactNumber: '+1234567890',
    };

    describe('Successful Organization Creation', () => {
      it('should create a new organization with valid data', async () => {
        const response = await request(app.getHttpServer())
          .post('/organizations')
          .send(validOrganizationData)
          .expect(201);

        // Verify response structure
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty(
          'name',
          validOrganizationData.name,
        );
        expect(response.body).toHaveProperty(
          'email',
          validOrganizationData.email.toLowerCase(),
        );
        expect(response.body).toHaveProperty(
          'contactNumber',
          validOrganizationData.contactNumber,
        );
        expect(response.body).toHaveProperty('totalMemberCount', 0);
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body).toHaveProperty('updatedAt');

        // Verify ID is a valid UUID
        expect(response.body.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );

        // Verify organization was created in database
        const createdOrg = await prismaService.organization.findUnique({
          where: { id: response.body.id },
        });
        expect(createdOrg).toBeTruthy();
        expect(createdOrg!.name).toBe(validOrganizationData.name);
        expect(createdOrg!.email).toBe(
          validOrganizationData.email.toLowerCase(),
        );
        expect(createdOrg!.contactNumber).toBe(
          validOrganizationData.contactNumber,
        );
        expect(createdOrg!.totalMemberCount).toBe(0);
        expect(createdOrg!.maxUsers).toBe(10); // Default value
        expect(createdOrg!.maxConcurrentJobs).toBe(5); // Default value
        expect(createdOrg!.archivedAt).toBe(null);

        testOrganizationId = response.body.id;
      });

      it('should handle different valid organization name formats', async () => {
        const testCases = [
          {
            ...validOrganizationData,
            name: 'Test Org 123',
            email: 'test1@org-test.com',
          },
          {
            ...validOrganizationData,
            name: "O'Connor & Associates",
            email: 'test2@org-test.com',
          },
          {
            ...validOrganizationData,
            name: 'Tech-Solutions Inc.',
            email: 'test3@org-test.com',
          },
          {
            ...validOrganizationData,
            name: 'Müller GmbH',
            email: 'test4@org-test.com',
          },
        ];

        for (const testCase of testCases) {
          const response = await request(app.getHttpServer())
            .post('/organizations')
            .send(testCase)
            .expect(201);

          expect(response.body.name).toBe(testCase.name);
          expect(response.body.email).toBe(testCase.email.toLowerCase());
        }
      });

      it('should handle different valid contact number formats', async () => {
        const testCases = [
          {
            ...validOrganizationData,
            contactNumber: '+1 234 567 8900',
            email: 'contact1@org-test.com',
          },
          {
            ...validOrganizationData,
            contactNumber: '(555) 123-4567',
            email: 'contact2@org-test.com',
          },
          {
            ...validOrganizationData,
            contactNumber: '+44 20 7946 0958',
            email: 'contact3@org-test.com',
          },
          {
            ...validOrganizationData,
            contactNumber: '1234567890',
            email: 'contact4@org-test.com',
          },
        ];

        for (const testCase of testCases) {
          const response = await request(app.getHttpServer())
            .post('/organizations')
            .send(testCase)
            .expect(201);

          expect(response.body.contactNumber).toBe(testCase.contactNumber);
        }
      });

      it('should normalize email to lowercase', async () => {
        const response = await request(app.getHttpServer())
          .post('/organizations')
          .send({
            ...validOrganizationData,
            email: 'UPPERCASE@ORG-TEST.COM',
          })
          .expect(201);

        expect(response.body.email).toBe('uppercase@org-test.com');
      });

      it('should trim whitespace from input fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/organizations')
          .send({
            name: '  Trimmed Organization  ',
            email: '  trimmed@org-test.com  ',
            contactNumber: '  +1234567890  ',
          })
          .expect(201);

        expect(response.body.name).toBe('Trimmed Organization');
        expect(response.body.email).toBe('trimmed@org-test.com');
        expect(response.body.contactNumber).toBe('+1234567890');
      });
    });

    describe('Validation Errors', () => {
      it('should reject organization creation with missing required fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/organizations')
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
        expect(response.body).toHaveProperty('message');
        expect(Array.isArray(response.body.message)).toBe(true);

        const messages = response.body.message.join(' ');
        expect(messages).toContain('name');
        expect(messages).toContain('email');
        expect(messages).toContain('contactNumber');
      });

      it('should reject organization with invalid name formats', async () => {
        const invalidNames = [
          '',
          'A',
          'A'.repeat(101),
          '  ',
          'Test<script>',
          'Test@Organization',
          'Test\nOrg',
          'Test\tOrg',
        ];

        for (const name of invalidNames) {
          const response = await request(app.getHttpServer())
            .post('/organizations')
            .send({ ...validOrganizationData, name })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should reject organization with invalid email formats', async () => {
        const invalidEmails = [
          'invalid-email',
          '@example.com',
          'user@',
          'user.example.com',
          'user@domain',
          'user with spaces@example.com',
          'user<script>@example.com',
          'user"quote@example.com',
          'user;semicolon@example.com',
        ];

        for (const email of invalidEmails) {
          const response = await request(app.getHttpServer())
            .post('/organizations')
            .send({ ...validOrganizationData, email })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should reject organization with invalid contact number formats', async () => {
        const invalidContactNumbers = [
          '',
          '123',
          '123456789',
          '12345678901234567890123456789',
          'abc1234567890',
          '123-456-789a',
          '123@456.7890',
          '+',
          '()',
          '+-123456789',
        ];

        for (const contactNumber of invalidContactNumbers) {
          const response = await request(app.getHttpServer())
            .post('/organizations')
            .send({ ...validOrganizationData, contactNumber })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });

      it('should reject organization with extra fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/organizations')
          .send({
            ...validOrganizationData,
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
        // Create an organization for conflict testing
        await request(app.getHttpServer())
          .post('/organizations')
          .send(validOrganizationData)
          .expect(201);
      });

      it('should reject organization creation with existing email', async () => {
        const response = await request(app.getHttpServer())
          .post('/organizations')
          .send({
            ...validOrganizationData,
            name: 'Different Organization',
            email: validOrganizationData.email, // Same email
          })
          .expect(409);

        expect(response.body).toHaveProperty('error', 'Conflict');
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('already exists');
      });

      it('should handle case-insensitive email conflicts', async () => {
        const response = await request(app.getHttpServer())
          .post('/organizations')
          .send({
            ...validOrganizationData,
            name: 'Different Organization',
            email: validOrganizationData.email.toUpperCase(),
          })
          .expect(409);

        expect(response.body).toHaveProperty('error', 'Conflict');
      });
    });

    describe('Security Features', () => {
      it('should include proper security headers in response', async () => {
        const response = await request(app.getHttpServer())
          .post('/organizations')
          .send(validOrganizationData);

        expect(response.headers).toHaveProperty('x-request-id');
        expect(response.headers).toHaveProperty('x-api-version');
      });

      it('should sanitize potentially malicious input', async () => {
        const maliciousData = {
          name: '<script>alert("xss")</script>Organization',
          email: 'test@org-test.com',
          contactNumber: '+1234567890',
        };

        const response = await request(app.getHttpServer())
          .post('/organizations')
          .send(maliciousData)
          .expect(400); // Should be rejected by validation

        expect(response.body).toHaveProperty('error', 'Bad Request');
      });

      it('should handle SQL injection attempts', async () => {
        const sqlInjectionAttempts = [
          "'; DROP TABLE organizations; --",
          "' OR '1'='1' --",
          "' UNION SELECT * FROM organizations --",
        ];

        for (const maliciousName of sqlInjectionAttempts) {
          const response = await request(app.getHttpServer())
            .post('/organizations')
            .send({
              ...validOrganizationData,
              name: maliciousName,
            })
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });
    });

    describe('Performance and Concurrent Creation', () => {
      it('should handle multiple concurrent organization creations', async () => {
        const concurrentOrgs = 3;
        const promises = [];

        for (let i = 0; i < concurrentOrgs; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/organizations')
              .send({
                name: `Concurrent Organization ${i}`,
                email: `concurrent${i}@org-test.com`,
                contactNumber: `+123456789${i}`,
              }),
          );
        }

        const responses = await Promise.all(promises);

        // All should succeed
        responses.forEach((response) => {
          expect(response.status).toBe(201);
          expect(response.body).toHaveProperty('id');
          expect(response.body).toHaveProperty('name');
        });

        // Verify all organizations were created in database
        const createdOrgs = await prismaService.organization.findMany({
          where: {
            email: {
              startsWith: 'concurrent',
            },
          },
        });

        expect(createdOrgs).toHaveLength(concurrentOrgs);
      }, 10000);

      it('should respond within acceptable time limits', async () => {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .post('/organizations')
          .send(validOrganizationData)
          .expect(201);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(2000);
      });
    });

    describe('Database Integration', () => {
      it('should create organization with proper database constraints', async () => {
        const response = await request(app.getHttpServer())
          .post('/organizations')
          .send(validOrganizationData)
          .expect(201);

        const createdOrg = await prismaService.organization.findUnique({
          where: { id: response.body.id },
        });

        // Verify all database fields
        expect(createdOrg).toBeTruthy();
        expect(createdOrg!.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ); // UUID format
        expect(createdOrg!.name).toBe(validOrganizationData.name);
        expect(createdOrg!.email).toBe(
          validOrganizationData.email.toLowerCase(),
        );
        expect(createdOrg!.contactNumber).toBe(
          validOrganizationData.contactNumber,
        );
        expect(createdOrg!.totalMemberCount).toBe(0);
        expect(createdOrg!.maxUsers).toBe(10); // Default value
        expect(createdOrg!.maxConcurrentJobs).toBe(5); // Default value
        expect(createdOrg!.archivedAt).toBe(null);
        expect(createdOrg!.createdAt).toBeInstanceOf(Date);
        expect(createdOrg!.updatedAt).toBeInstanceOf(Date);
      });

      it('should enforce unique email constraint', async () => {
        // Create first organization
        await request(app.getHttpServer())
          .post('/organizations')
          .send(validOrganizationData)
          .expect(201);

        // Try to create organization with same email
        await request(app.getHttpServer())
          .post('/organizations')
          .send({
            ...validOrganizationData,
            name: 'Different Organization',
          })
          .expect(409);
      });
    });
  });

  describe('GET /organizations', () => {
    beforeEach(async () => {
      // Create test organizations
      await request(app.getHttpServer())
        .post('/organizations')
        .send({
          name: 'First Organization',
          email: 'first@org-test.com',
          contactNumber: '+1234567890',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/organizations')
        .send({
          name: 'Second Organization',
          email: 'second@org-test.com',
          contactNumber: '+1234567891',
        })
        .expect(201);
    });

    describe('Successful Organization Retrieval', () => {
      it('should get all organizations', async () => {
        const response = await request(app.getHttpServer())
          .get('/organizations')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);

        // Verify structure of returned organizations
        response.body.forEach((org: any) => {
          expect(org).toHaveProperty('id');
          expect(org).toHaveProperty('name');
          expect(org).toHaveProperty('email');
          expect(org).toHaveProperty('contactNumber');
          expect(org).toHaveProperty('totalMemberCount');
          expect(org).toHaveProperty('createdAt');
          expect(org).toHaveProperty('updatedAt');
          expect(org).not.toHaveProperty('maxUsers'); // Should be excluded from response
          expect(org).not.toHaveProperty('maxConcurrentJobs'); // Should be excluded from response
          expect(org).not.toHaveProperty('archivedAt'); // Should be excluded from response
        });
      });

      it('should handle empty organization list', async () => {
        // Clean up all organizations
        await cleanupTestData();

        const response = await request(app.getHttpServer())
          .get('/organizations')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(0);
      });
    });
  });

  describe('GET /organizations/:id', () => {
    let organizationId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/organizations')
        .send({
          name: 'Test Organization for Get',
          email: 'gettest@org-test.com',
          contactNumber: '+1234567892',
        })
        .expect(201);

      organizationId = response.body.id;
    });

    describe('Successful Organization Retrieval by ID', () => {
      it('should get organization by valid ID', async () => {
        const response = await request(app.getHttpServer())
          .get(`/organizations/${organizationId}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', organizationId);
        expect(response.body).toHaveProperty(
          'name',
          'Test Organization for Get',
        );
        expect(response.body).toHaveProperty('email', 'gettest@org-test.com');
        expect(response.body).toHaveProperty('contactNumber', '+1234567892');
        expect(response.body).toHaveProperty('totalMemberCount', 0);
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body).toHaveProperty('updatedAt');
      });
    });

    describe('Organization Not Found Errors', () => {
      it('should return 404 for non-existent organization ID', async () => {
        const nonExistentId = '12345678-1234-1234-1234-123456789012';

        const response = await request(app.getHttpServer())
          .get(`/organizations/${nonExistentId}`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Not Found');
        expect(response.body.message).toContain('not found');
      });

      it('should return 400 for invalid UUID format', async () => {
        const invalidIds = [
          'invalid-uuid',
          '123',
          'not-a-uuid',
          '12345678-1234-1234-1234-12345678901',
          '12345678-1234-1234-1234-1234567890123',
          '12345678-1234-1234-1234-12345678901g',
        ];

        for (const invalidId of invalidIds) {
          const response = await request(app.getHttpServer())
            .get(`/organizations/${invalidId}`)
            .expect(400);

          expect(response.body).toHaveProperty('error', 'Bad Request');
        }
      });
    });
  });

  describe('Organization Creation Flow Integration', () => {
    it('should complete full organization creation and retrieval flow', async () => {
      // 1. Create organization
      const createResponse = await request(app.getHttpServer())
        .post('/organizations')
        .send({
          name: 'Integration Test Org',
          email: 'integration@org-test.com',
          contactNumber: '+1234567893',
        })
        .expect(201);

      const orgId = createResponse.body.id;
      expect(orgId).toBeTruthy();

      // 2. Retrieve organization by ID
      const getResponse = await request(app.getHttpServer())
        .get(`/organizations/${orgId}`)
        .expect(200);

      expect(getResponse.body.id).toBe(orgId);
      expect(getResponse.body.name).toBe('Integration Test Org');

      // 3. List all organizations (should include our new org)
      const listResponse = await request(app.getHttpServer())
        .get('/organizations')
        .expect(200);

      const foundOrg = listResponse.body.find((org: any) => org.id === orgId);
      expect(foundOrg).toBeTruthy();
      expect(foundOrg.name).toBe('Integration Test Org');

      // 4. Verify database consistency
      const dbOrg = await prismaService.organization.findUnique({
        where: { id: orgId },
      });

      expect(dbOrg).toBeTruthy();
      expect(dbOrg!.name).toBe('Integration Test Org');
      expect(dbOrg!.email).toBe('integration@org-test.com');
      expect(dbOrg!.totalMemberCount).toBe(0);
    });

    it('should maintain data consistency across multiple operations', async () => {
      const orgPromises = [];

      // Create multiple organizations concurrently
      for (let i = 0; i < 3; i++) {
        orgPromises.push(
          request(app.getHttpServer())
            .post('/organizations')
            .send({
              name: `Consistency Test Org ${i}`,
              email: `consistency${i}@org-test.com`,
              contactNumber: `+123456789${i}`,
            }),
        );
      }

      const createResponses = await Promise.all(orgPromises);

      // Verify all were created successfully
      createResponses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });

      // Retrieve all and verify consistency
      const listResponse = await request(app.getHttpServer())
        .get('/organizations')
        .expect(200);

      const consistencyOrgs = listResponse.body.filter((org: any) =>
        org.name.startsWith('Consistency Test Org'),
      );

      expect(consistencyOrgs).toHaveLength(3);

      // Verify each organization individually
      for (const createResponse of createResponses) {
        const orgId = createResponse.body.id;
        const getResponse = await request(app.getHttpServer())
          .get(`/organizations/${orgId}`)
          .expect(200);

        expect(getResponse.body.id).toBe(orgId);
        expect(getResponse.body).toEqual(createResponse.body);
      }
    });
  });
});
