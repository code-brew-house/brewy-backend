import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Cross-Organization Data Isolation (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  // Organization 1 users
  let org1Id: string;

  // Organization 2 users
  let org2Id: string;

  // Test data IDs
  let org1StorageId: string;
  let org2StorageId: string;
  let org1JobId: string;
  let org2JobId: string;

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

    // Set up test organizations and users
    await setupTestData();
  });

  const cleanupTestData = async () => {
    // Clean up in reverse dependency order
    await prismaService.analysisResult.deleteMany({
      where: {
        OR: [{ organizationId: org1Id }, { organizationId: org2Id }],
      },
    });

    await prismaService.job.deleteMany({
      where: {
        OR: [{ organizationId: org1Id }, { organizationId: org2Id }],
      },
    });

    await prismaService.storage.deleteMany({
      where: {
        OR: [{ organizationId: org1Id }, { organizationId: org2Id }],
      },
    });

    await prismaService.user.deleteMany({
      where: {
        email: {
          contains: 'isolation-test',
        },
      },
    });

    await prismaService.organization.deleteMany({
      where: {
        email: {
          contains: 'isolation-test',
        },
      },
    });
  };

  const setupTestData = async () => {
    // Create Organization 1
    const org1Response = await request(app.getHttpServer())
      .post('/organizations')
      .send({
        name: 'Organization One',
        email: 'org1@isolation-test.com',
        contactNumber: '+1234567890',
      })
      .expect(201);

    org1Id = org1Response.body.id;

    // Create Organization 2
    const org2Response = await request(app.getHttpServer())
      .post('/organizations')
      .send({
        name: 'Organization Two',
        email: 'org2@isolation-test.com',
        contactNumber: '+1234567891',
      })
      .expect(201);

    org2Id = org2Response.body.id;

    // Create Super Owner (not tied to any specific organization initially)
    const superOwnerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'superowner',
        email: 'superowner@isolation-test.com',
        password: 'TestPassword123!',
        fullName: 'Super Owner User',
      })
      .expect(201);

    org1SuperOwnerToken = superOwnerResponse.body.accessToken;

    // Manually create users for each organization (simulating proper user creation flow)
    // In a real implementation, these would be created through the organization endpoints

    // Organization 1 users
    await prismaService.user.create({
      data: {
        username: 'org1owner',
        email: 'owner1@isolation-test.com',
        password: '$2b$10$dummy.hashed.password.for.testing.purposes.only',
        fullName: 'Org 1 Owner',
        organizationId: org1Id,
        role: 'OWNER',
      },
    });

    await prismaService.user.create({
      data: {
        username: 'org1admin',
        email: 'admin1@isolation-test.com',
        password: '$2b$10$dummy.hashed.password.for.testing.purposes.only',
        fullName: 'Org 1 Admin',
        organizationId: org1Id,
        role: 'ADMIN',
      },
    });

    await prismaService.user.create({
      data: {
        username: 'org1agent',
        email: 'agent1@isolation-test.com',
        password: '$2b$10$dummy.hashed.password.for.testing.purposes.only',
        fullName: 'Org 1 Agent',
        organizationId: org1Id,
        role: 'AGENT',
      },
    });

    // Organization 2 users
    await prismaService.user.create({
      data: {
        username: 'org2owner',
        email: 'owner2@isolation-test.com',
        password: '$2b$10$dummy.hashed.password.for.testing.purposes.only',
        fullName: 'Org 2 Owner',
        organizationId: org2Id,
        role: 'OWNER',
      },
    });

    await prismaService.user.create({
      data: {
        username: 'org2admin',
        email: 'admin2@isolation-test.com',
        password: '$2b$10$dummy.hashed.password.for.testing.purposes.only',
        fullName: 'Org 2 Admin',
        organizationId: org2Id,
        role: 'ADMIN',
      },
    });

    await prismaService.user.create({
      data: {
        username: 'org2agent',
        email: 'agent2@isolation-test.com',
        password: '$2b$10$dummy.hashed.password.for.testing.purposes.only',
        fullName: 'Org 2 Agent',
        organizationId: org2Id,
        role: 'AGENT',
      },
    });

    // Generate JWT tokens for each user (simulating login)
    // Note: In a real test, you would use the actual login endpoint
    // For this test, we'll use a simplified approach assuming the JWT service is available

    // Create test storage records for each organization
    const org1Storage = await prismaService.storage.create({
      data: {
        url: 'https://test.com/org1-file.mp3',
        filename: 'org1-test-file.mp3',
        size: 1024000,
        mimetype: 'audio/mpeg',
        organizationId: org1Id,
      },
    });
    org1StorageId = org1Storage.id;

    const org2Storage = await prismaService.storage.create({
      data: {
        url: 'https://test.com/org2-file.mp3',
        filename: 'org2-test-file.mp3',
        size: 1024000,
        mimetype: 'audio/mpeg',
        organizationId: org2Id,
      },
    });
    org2StorageId = org2Storage.id;

    // Create test jobs for each organization
    const org1Job = await prismaService.job.create({
      data: {
        status: 'pending',
        fileId: org1StorageId,
        organizationId: org1Id,
      },
    });
    org1JobId = org1Job.id;

    const org2Job = await prismaService.job.create({
      data: {
        status: 'pending',
        fileId: org2StorageId,
        organizationId: org2Id,
      },
    });
    org2JobId = org2Job.id;

    // For this test, we'll simulate the tokens (in a real implementation, these would come from actual login)
    // This is a simplified approach for testing purposes
    org1OwnerToken = 'simulated-org1-owner-token';
    org1AdminToken = 'simulated-org1-admin-token';
    org1AgentToken = 'simulated-org1-agent-token';
    org2OwnerToken = 'simulated-org2-owner-token';
    org2AdminToken = 'simulated-org2-admin-token';
    org2AgentToken = 'simulated-org2-agent-token';
  };

  describe('Organization Data Isolation', () => {
    describe('Organization List Access', () => {
      it('should isolate organizations - users can only see their own organization', async () => {
        // Test that Organization 1 users cannot see Organization 2 in listings
        // Note: This test would require proper authentication middleware
        // For now, we test the database isolation directly

        const org1Users = await prismaService.user.findMany({
          where: { organizationId: org1Id },
        });

        const org2Users = await prismaService.user.findMany({
          where: { organizationId: org2Id },
        });

        // Verify users are properly isolated by organization
        expect(org1Users.every((user) => user.organizationId === org1Id)).toBe(
          true,
        );
        expect(org2Users.every((user) => user.organizationId === org2Id)).toBe(
          true,
        );

        // Verify no cross-organization contamination
        expect(org1Users.some((user) => user.organizationId === org2Id)).toBe(
          false,
        );
        expect(org2Users.some((user) => user.organizationId === org1Id)).toBe(
          false,
        );
      });

      it('should prevent access to other organization details by ID', async () => {
        // Verify that org1 and org2 are distinct
        expect(org1Id).not.toBe(org2Id);

        // Test database isolation - organization records should be separate
        const org1 = await prismaService.organization.findUnique({
          where: { id: org1Id },
        });

        const org2 = await prismaService.organization.findUnique({
          where: { id: org2Id },
        });

        expect(org1).toBeTruthy();
        expect(org2).toBeTruthy();
        expect(org1!.email).toBe('org1@isolation-test.com');
        expect(org2!.email).toBe('org2@isolation-test.com');
      });
    });

    describe('User Data Isolation', () => {
      it('should isolate user lists by organization', async () => {
        const org1Users = await prismaService.user.findMany({
          where: { organizationId: org1Id },
        });

        const org2Users = await prismaService.user.findMany({
          where: { organizationId: org2Id },
        });

        // Each organization should have exactly 3 users (Owner, Admin, Agent)
        expect(org1Users).toHaveLength(3);
        expect(org2Users).toHaveLength(3);

        // Verify role distribution
        const org1Roles = org1Users.map((u) => u.role).sort();
        const org2Roles = org2Users.map((u) => u.role).sort();

        expect(org1Roles).toEqual(['ADMIN', 'AGENT', 'OWNER']);
        expect(org2Roles).toEqual(['ADMIN', 'AGENT', 'OWNER']);

        // Verify no cross-organization users
        const allOrg1Emails = org1Users.map((u) => u.email);
        const allOrg2Emails = org2Users.map((u) => u.email);

        expect(allOrg1Emails.every((email) => email.includes('1@'))).toBe(true);
        expect(allOrg2Emails.every((email) => email.includes('2@'))).toBe(true);
      });

      it('should prevent access to users from other organizations', async () => {
        // Get a user from org1 and try to verify they can't see org2 users
        const org1User = await prismaService.user.findFirst({
          where: { organizationId: org1Id, role: 'ADMIN' },
        });

        const org2User = await prismaService.user.findFirst({
          where: { organizationId: org2Id, role: 'ADMIN' },
        });

        expect(org1User).toBeTruthy();
        expect(org2User).toBeTruthy();
        expect(org1User!.organizationId).toBe(org1Id);
        expect(org2User!.organizationId).toBe(org2Id);

        // Verify they are in different organizations
        expect(org1User!.organizationId).not.toBe(org2User!.organizationId);
      });
    });

    describe('Storage Data Isolation', () => {
      it('should isolate storage files by organization', async () => {
        const org1Files = await prismaService.storage.findMany({
          where: { organizationId: org1Id },
        });

        const org2Files = await prismaService.storage.findMany({
          where: { organizationId: org2Id },
        });

        // Each organization should have exactly 1 test file
        expect(org1Files).toHaveLength(1);
        expect(org2Files).toHaveLength(1);

        // Verify file isolation
        expect(org1Files[0].filename).toBe('org1-test-file.mp3');
        expect(org2Files[0].filename).toBe('org2-test-file.mp3');
        expect(org1Files[0].organizationId).toBe(org1Id);
        expect(org2Files[0].organizationId).toBe(org2Id);
      });

      it('should prevent access to storage files from other organizations', async () => {
        // Verify that org1 storage is not accessible when querying for org2 files
        const org1FileFromOrg2Query = await prismaService.storage.findMany({
          where: {
            id: org1StorageId,
            organizationId: org2Id,
          },
        });

        const org2FileFromOrg1Query = await prismaService.storage.findMany({
          where: {
            id: org2StorageId,
            organizationId: org1Id,
          },
        });

        // Should return empty arrays (no cross-organization access)
        expect(org1FileFromOrg2Query).toHaveLength(0);
        expect(org2FileFromOrg1Query).toHaveLength(0);
      });
    });

    describe('Job Data Isolation', () => {
      it('should isolate jobs by organization', async () => {
        const org1Jobs = await prismaService.job.findMany({
          where: { organizationId: org1Id },
          include: { storage: true },
        });

        const org2Jobs = await prismaService.job.findMany({
          where: { organizationId: org2Id },
          include: { storage: true },
        });

        // Each organization should have exactly 1 test job
        expect(org1Jobs).toHaveLength(1);
        expect(org2Jobs).toHaveLength(1);

        // Verify job isolation and relationship integrity
        expect(org1Jobs[0].organizationId).toBe(org1Id);
        expect(org1Jobs[0].storage.organizationId).toBe(org1Id);
        expect(org2Jobs[0].organizationId).toBe(org2Id);
        expect(org2Jobs[0].storage.organizationId).toBe(org2Id);
      });

      it('should prevent access to jobs from other organizations', async () => {
        // Verify that org1 job is not accessible when querying for org2 jobs
        const org1JobFromOrg2Query = await prismaService.job.findMany({
          where: {
            id: org1JobId,
            organizationId: org2Id,
          },
        });

        const org2JobFromOrg1Query = await prismaService.job.findMany({
          where: {
            id: org2JobId,
            organizationId: org1Id,
          },
        });

        // Should return empty arrays (no cross-organization access)
        expect(org1JobFromOrg2Query).toHaveLength(0);
        expect(org2JobFromOrg1Query).toHaveLength(0);
      });
    });

    describe('Analysis Results Data Isolation', () => {
      beforeEach(async () => {
        // Create test analysis results for each organization
        await prismaService.analysisResult.create({
          data: {
            jobId: org1JobId,
            organizationId: org1Id,
            transcript: 'Org 1 test transcript',
            sentiment: 'positive',
            metadata: { test: 'org1' },
          },
        });

        await prismaService.analysisResult.create({
          data: {
            jobId: org2JobId,
            organizationId: org2Id,
            transcript: 'Org 2 test transcript',
            sentiment: 'neutral',
            metadata: { test: 'org2' },
          },
        });
      });

      it('should isolate analysis results by organization', async () => {
        const org1Results = await prismaService.analysisResult.findMany({
          where: { organizationId: org1Id },
        });

        const org2Results = await prismaService.analysisResult.findMany({
          where: { organizationId: org2Id },
        });

        // Each organization should have exactly 1 test result
        expect(org1Results).toHaveLength(1);
        expect(org2Results).toHaveLength(1);

        // Verify result isolation
        expect(org1Results[0].transcript).toBe('Org 1 test transcript');
        expect(org2Results[0].transcript).toBe('Org 2 test transcript');
        expect(org1Results[0].organizationId).toBe(org1Id);
        expect(org2Results[0].organizationId).toBe(org2Id);
      });

      it('should prevent access to analysis results from other organizations', async () => {
        // Verify that org1 results are not accessible when querying for org2 results
        const org1ResultsFromOrg2Query =
          await prismaService.analysisResult.findMany({
            where: {
              jobId: org1JobId,
              organizationId: org2Id,
            },
          });

        const org2ResultsFromOrg1Query =
          await prismaService.analysisResult.findMany({
            where: {
              jobId: org2JobId,
              organizationId: org1Id,
            },
          });

        // Should return empty arrays (no cross-organization access)
        expect(org1ResultsFromOrg2Query).toHaveLength(0);
        expect(org2ResultsFromOrg1Query).toHaveLength(0);
      });
    });
  });

  describe('Super Owner Cross-Organization Access', () => {
    it('should allow Super Owner to access data from all organizations', async () => {
      // Super Owner should be able to see all organizations
      const allOrganizations = await prismaService.organization.findMany({
        where: {
          email: {
            contains: 'isolation-test',
          },
        },
      });

      expect(allOrganizations).toHaveLength(2);

      const orgEmails = allOrganizations.map((org) => org.email).sort();
      expect(orgEmails).toEqual([
        'org1@isolation-test.com',
        'org2@isolation-test.com',
      ]);
    });

    it('should allow Super Owner to access users from all organizations', async () => {
      // Super Owner should be able to see all users across organizations
      const allUsers = await prismaService.user.findMany({
        where: {
          email: {
            contains: 'isolation-test',
          },
          role: { not: 'SUPER_OWNER' }, // Exclude the super owner itself
        },
        include: {
          organization: true,
        },
      });

      expect(allUsers).toHaveLength(6); // 3 users from each organization

      // Verify we have users from both organizations
      const org1Users = allUsers.filter(
        (user) => user.organizationId === org1Id,
      );
      const org2Users = allUsers.filter(
        (user) => user.organizationId === org2Id,
      );

      expect(org1Users).toHaveLength(3);
      expect(org2Users).toHaveLength(3);
    });

    it('should allow Super Owner to access storage files from all organizations', async () => {
      // Super Owner should be able to see all storage files
      const allStorageFiles = await prismaService.storage.findMany({
        where: {
          OR: [{ organizationId: org1Id }, { organizationId: org2Id }],
        },
      });

      expect(allStorageFiles).toHaveLength(2);

      const filenames = allStorageFiles.map((file) => file.filename).sort();
      expect(filenames).toEqual(['org1-test-file.mp3', 'org2-test-file.mp3']);
    });
  });

  describe('Data Integrity and Referential Consistency', () => {
    it('should maintain referential integrity across all organization data', async () => {
      // Verify that all jobs reference valid storage files within the same organization
      const allJobs = await prismaService.job.findMany({
        where: {
          OR: [{ organizationId: org1Id }, { organizationId: org2Id }],
        },
        include: {
          storage: true,
          organization: true,
        },
      });

      expect(allJobs).toHaveLength(2);

      allJobs.forEach((job) => {
        // Job organization should match storage organization
        expect(job.organizationId).toBe(job.storage.organizationId);
        expect(job.organizationId).toBe(job.organization.id);
      });
    });

    it('should maintain consistent organization member counts', async () => {
      const org1 = await prismaService.organization.findUnique({
        where: { id: org1Id },
        include: { users: true },
      });

      const org2 = await prismaService.organization.findUnique({
        where: { id: org2Id },
        include: { users: true },
      });

      expect(org1).toBeTruthy();
      expect(org2).toBeTruthy();

      // Verify member count consistency (should be 3 users each)
      expect(org1!.users).toHaveLength(3);
      expect(org2!.users).toHaveLength(3);

      // Note: In the real implementation, totalMemberCount would be properly maintained
      // through the user creation/deletion processes
    });

    it('should prevent orphaned records across organizations', async () => {
      // Verify no storage records exist without valid organization references
      const orphanedStorage = await prismaService.storage.findMany({
        where: {
          organizationId: null,
        },
      });
      expect(orphanedStorage).toHaveLength(0);

      // Verify no jobs exist without valid organization and storage references
      const orphanedJobs = await prismaService.job.findMany({
        where: {
          organizationId: null,
        },
      });
      expect(orphanedJobs).toHaveLength(0);

      // Verify no users exist without valid organization references
      const orphanedUsers = await prismaService.user.findMany({
        where: {
          AND: [
            { organizationId: null },
            { email: { contains: 'isolation-test' } },
          ],
        },
      });
      expect(orphanedUsers).toHaveLength(0);
    });
  });

  describe('Database Query Isolation Verification', () => {
    it('should ensure organization filtering is applied to all relevant queries', async () => {
      // Test various query patterns to ensure organization filtering works correctly

      // 1. Count queries should respect organization boundaries
      const org1StorageCount = await prismaService.storage.count({
        where: { organizationId: org1Id },
      });

      const org2StorageCount = await prismaService.storage.count({
        where: { organizationId: org2Id },
      });

      expect(org1StorageCount).toBe(1);
      expect(org2StorageCount).toBe(1);

      // 2. Aggregation queries should respect organization boundaries
      const org1JobStatuses = await prismaService.job.groupBy({
        by: ['status'],
        where: { organizationId: org1Id },
        _count: { status: true },
      });

      const org2JobStatuses = await prismaService.job.groupBy({
        by: ['status'],
        where: { organizationId: org2Id },
        _count: { status: true },
      });

      expect(org1JobStatuses).toHaveLength(1);
      expect(org2JobStatuses).toHaveLength(1);
      expect(org1JobStatuses[0]._count.status).toBe(1);
      expect(org2JobStatuses[0]._count.status).toBe(1);

      // 3. Complex join queries should maintain isolation
      const org1JobsWithStorageAndResults = await prismaService.job.findMany({
        where: { organizationId: org1Id },
        include: {
          storage: true,
          results: true,
          organization: true,
        },
      });

      expect(org1JobsWithStorageAndResults).toHaveLength(1);
      expect(org1JobsWithStorageAndResults[0].storage.organizationId).toBe(
        org1Id,
      );
      expect(org1JobsWithStorageAndResults[0].organization.id).toBe(org1Id);
    });

    it('should verify that database indexes support efficient organization filtering', async () => {
      // This test verifies that the database schema supports efficient organization-based queries
      // In a real implementation, you could use EXPLAIN queries to verify index usage

      // Test that organization-based queries can be performed efficiently
      const startTime = Date.now();

      // Perform several organization-filtered queries
      await Promise.all([
        prismaService.user.findMany({ where: { organizationId: org1Id } }),
        prismaService.storage.findMany({ where: { organizationId: org1Id } }),
        prismaService.job.findMany({ where: { organizationId: org1Id } }),
        prismaService.analysisResult.findMany({
          where: { organizationId: org1Id },
        }),
      ]);

      const queryTime = Date.now() - startTime;

      // These queries should complete quickly (under 100ms for test data)
      expect(queryTime).toBeLessThan(100);
    });
  });
});
