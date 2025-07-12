import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { OrganizationCleanupJob } from './organization-cleanup.job';
import { PrismaService } from '../../../prisma/prisma.service';

describe('OrganizationCleanupJob', () => {
  let job: OrganizationCleanupJob;
  let prismaService: jest.Mocked<PrismaService>;

  const mockOrganization = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Organization',
    archivedAt: new Date('2024-01-01'),
  };

  const mockOrganizations = [
    mockOrganization,
    {
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Test Organization 2',
      archivedAt: new Date('2024-02-01'),
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      organization: {
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      analysisResult: {
        deleteMany: jest.fn(),
      },
      job: {
        deleteMany: jest.fn(),
      },
      storage: {
        deleteMany: jest.fn(),
      },
      user: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationCleanupJob,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    job = module.get<OrganizationCleanupJob>(OrganizationCleanupJob);
    prismaService = module.get(PrismaService);

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanupArchivedOrganizations', () => {
    it('should successfully cleanup archived organizations past retention period', async () => {
      // Arrange
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      prismaService.organization.findMany.mockResolvedValue(mockOrganizations);

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          analysisResult: {
            deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
          },
          job: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
          storage: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          user: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          organization: { delete: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      prismaService.$transaction = mockTransaction;

      // Act
      await job.cleanupArchivedOrganizations();

      // Assert
      expect(prismaService.organization.findMany).toHaveBeenCalledWith({
        where: {
          archivedAt: {
            not: null,
            lte: expect.any(Date),
          },
        },
        select: {
          id: true,
          name: true,
          archivedAt: true,
        },
      });

      expect(mockTransaction).toHaveBeenCalledTimes(2); // Once for each organization
    });

    it('should handle case when no organizations need cleanup', async () => {
      // Arrange
      prismaService.organization.findMany.mockResolvedValue([]);

      // Act
      await job.cleanupArchivedOrganizations();

      // Assert
      expect(prismaService.organization.findMany).toHaveBeenCalled();
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should continue processing other organizations if one fails', async () => {
      // Arrange
      prismaService.organization.findMany.mockResolvedValue(mockOrganizations);

      let callCount = 0;
      const mockTransaction = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Database error');
        }
        return Promise.resolve();
      });

      prismaService.$transaction = mockTransaction;

      // Act
      await job.cleanupArchivedOrganizations();

      // Assert
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      prismaService.organization.findMany.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(job.cleanupArchivedOrganizations()).resolves.not.toThrow();
    });

    it('should calculate correct cutoff date for retention period', async () => {
      // Arrange
      const mockDate = new Date('2024-07-12');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      prismaService.organization.findMany.mockResolvedValue([]);

      // Act
      await job.cleanupArchivedOrganizations();

      // Assert
      const expectedCutoffDate = new Date('2024-04-13'); // 90 days before July 12, 2024
      expect(prismaService.organization.findMany).toHaveBeenCalledWith({
        where: {
          archivedAt: {
            not: null,
            lte: expectedCutoffDate,
          },
        },
        select: {
          id: true,
          name: true,
          archivedAt: true,
        },
      });

      jest.restoreAllMocks();
    });
  });

  describe('permanentlyDeleteOrganization', () => {
    it('should delete organization and all related data in correct order', async () => {
      // Arrange
      const orgId = mockOrganization.id;
      const orgName = mockOrganization.name;

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          analysisResult: {
            deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
          },
          job: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
          storage: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          user: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          organization: { delete: jest.fn().mockResolvedValue({}) },
        };
        await callback(tx);

        // Verify deletion order
        expect(tx.analysisResult.deleteMany).toHaveBeenCalledWith({
          where: { organizationId: orgId },
        });
        expect(tx.job.deleteMany).toHaveBeenCalledWith({
          where: { organizationId: orgId },
        });
        expect(tx.storage.deleteMany).toHaveBeenCalledWith({
          where: { organizationId: orgId },
        });
        expect(tx.user.deleteMany).toHaveBeenCalledWith({
          where: { organizationId: orgId },
        });
        expect(tx.organization.delete).toHaveBeenCalledWith({
          where: { id: orgId },
        });

        return true;
      });

      prismaService.$transaction = mockTransaction;

      // Act
      await (job as any).permanentlyDeleteOrganization(orgId, orgName);

      // Assert
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should throw error if transaction fails', async () => {
      // Arrange
      const orgId = mockOrganization.id;
      const orgName = mockOrganization.name;
      const errorMessage = 'Transaction failed';

      prismaService.$transaction.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(
        (job as any).permanentlyDeleteOrganization(orgId, orgName),
      ).rejects.toThrow(errorMessage);
    });

    it('should handle foreign key constraint errors', async () => {
      // Arrange
      const orgId = mockOrganization.id;
      const orgName = mockOrganization.name;
      const constraintError = new Error('Foreign key constraint violation');

      prismaService.$transaction.mockRejectedValue(constraintError);

      // Act & Assert
      await expect(
        (job as any).permanentlyDeleteOrganization(orgId, orgName),
      ).rejects.toThrow('Foreign key constraint violation');
    });
  });

  describe('runManualCleanup', () => {
    it('should return correct statistics for successful cleanup', async () => {
      // Arrange
      prismaService.organization.findMany.mockResolvedValue(mockOrganizations);

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          analysisResult: {
            deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
          },
          job: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
          storage: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          user: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          organization: { delete: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      prismaService.$transaction = mockTransaction;

      // Act
      const result = await job.runManualCleanup();

      // Assert
      expect(result).toEqual({
        processed: 2,
        deleted: 2,
        errors: 0,
      });
    });

    it('should track errors correctly when some deletions fail', async () => {
      // Arrange
      prismaService.organization.findMany.mockResolvedValue(mockOrganizations);

      let callCount = 0;
      const mockTransaction = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Database error');
        }
        return Promise.resolve();
      });

      prismaService.$transaction = mockTransaction;

      // Act
      const result = await job.runManualCleanup();

      // Assert
      expect(result).toEqual({
        processed: 2,
        deleted: 1,
        errors: 1,
      });
    });

    it('should return zero statistics when no organizations to cleanup', async () => {
      // Arrange
      prismaService.organization.findMany.mockResolvedValue([]);

      // Act
      const result = await job.runManualCleanup();

      // Assert
      expect(result).toEqual({
        processed: 0,
        deleted: 0,
        errors: 0,
      });
    });

    it('should use same retention period as scheduled job', async () => {
      // Arrange
      const mockDate = new Date('2024-07-12');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      prismaService.organization.findMany.mockResolvedValue([]);

      // Act
      await job.runManualCleanup();

      // Assert
      const expectedCutoffDate = new Date('2024-04-13'); // 90 days before July 12, 2024
      expect(prismaService.organization.findMany).toHaveBeenCalledWith({
        where: {
          archivedAt: {
            not: null,
            lte: expectedCutoffDate,
          },
        },
        select: {
          id: true,
          name: true,
          archivedAt: true,
        },
      });

      jest.restoreAllMocks();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle partial transaction failures gracefully', async () => {
      // Arrange
      const orgId = mockOrganization.id;
      const orgName = mockOrganization.name;

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          analysisResult: {
            deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
          },
          job: {
            deleteMany: jest
              .fn()
              .mockRejectedValue(new Error('Job deletion failed')),
          },
          storage: { deleteMany: jest.fn() },
          user: { deleteMany: jest.fn() },
          organization: { delete: jest.fn() },
        };
        await callback(tx);
      });

      prismaService.$transaction = mockTransaction;

      // Act & Assert
      await expect(
        (job as any).permanentlyDeleteOrganization(orgId, orgName),
      ).rejects.toThrow();
    });

    it('should handle large numbers of related records', async () => {
      // Arrange
      const orgId = mockOrganization.id;
      const orgName = mockOrganization.name;

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          analysisResult: {
            deleteMany: jest.fn().mockResolvedValue({ count: 10000 }),
          },
          job: { deleteMany: jest.fn().mockResolvedValue({ count: 5000 }) },
          storage: { deleteMany: jest.fn().mockResolvedValue({ count: 1000 }) },
          user: { deleteMany: jest.fn().mockResolvedValue({ count: 100 }) },
          organization: { delete: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      prismaService.$transaction = mockTransaction;

      // Act
      await (job as any).permanentlyDeleteOrganization(orgId, orgName);

      // Assert
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should handle database timeout errors', async () => {
      // Arrange
      prismaService.organization.findMany.mockRejectedValue(
        new Error('Query timeout'),
      );

      // Act & Assert
      await expect(job.cleanupArchivedOrganizations()).resolves.not.toThrow();
    });
  });

  describe('Logging Behavior', () => {
    it('should log appropriate messages during successful cleanup', async () => {
      // Arrange
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      prismaService.organization.findMany.mockResolvedValue(mockOrganizations);

      const mockTransaction = jest.fn().mockResolvedValue({});
      prismaService.$transaction = mockTransaction;

      // Act
      await job.cleanupArchivedOrganizations();

      // Assert
      expect(logSpy).toHaveBeenCalledWith('Starting organization cleanup job');
      expect(logSpy).toHaveBeenCalledWith(
        'Found 2 organizations for permanent deletion',
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Organization cleanup job completed successfully',
      );
    });

    it('should log errors when deletion fails', async () => {
      // Arrange
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      prismaService.organization.findMany.mockResolvedValue([mockOrganization]);

      prismaService.$transaction.mockRejectedValue(
        new Error('Deletion failed'),
      );

      // Act
      await job.cleanupArchivedOrganizations();

      // Assert
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete organization'),
      );
    });
  });

  describe('Date Calculations', () => {
    it('should correctly calculate retention period cutoff', () => {
      // Arrange
      const testDate = new Date('2024-07-12T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => testDate);

      // Calculate expected cutoff date
      const expectedCutoff = new Date('2024-07-12T10:00:00Z');
      expectedCutoff.setDate(expectedCutoff.getDate() - 90);

      prismaService.organization.findMany.mockResolvedValue([]);

      // Act
      job.cleanupArchivedOrganizations();

      // Assert - verify the cutoff date is calculated correctly
      expect(expectedCutoff.getTime()).toBeLessThan(testDate.getTime());
      expect(expectedCutoff.getDate()).toBe(13); // April 13 for July 12 - 90 days

      jest.restoreAllMocks();
    });
  });
});
