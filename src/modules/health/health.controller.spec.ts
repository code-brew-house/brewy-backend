import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, HealthCheckResult } from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: jest.Mocked<HealthCheckService>;

  const mockHealthCheckResult: HealthCheckResult = {
    status: 'ok',
    info: {},
    error: {},
    details: {},
  };

  beforeEach(async () => {
    const mockHealthCheckService = {
      check: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get(HealthCheckService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health check result when system is healthy', async () => {
      // Arrange
      healthCheckService.check.mockResolvedValue(mockHealthCheckResult);

      // Act
      const result = await controller.check();

      // Assert
      expect(result).toEqual(mockHealthCheckResult);
      expect(healthCheckService.check).toHaveBeenCalledWith([]);
    });

    it('should handle health check with empty checks array', async () => {
      // Arrange
      const healthyResult: HealthCheckResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };
      healthCheckService.check.mockResolvedValue(healthyResult);

      // Act
      const result = await controller.check();

      // Assert
      expect(result.status).toBe('ok');
      expect(healthCheckService.check).toHaveBeenCalledWith([]);
    });

    it('should handle health check failure', async () => {
      // Arrange
      const unhealthyResult: HealthCheckResult = {
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: 'Connection failed',
          },
        },
        details: {
          database: {
            status: 'down',
            message: 'Connection failed',
          },
        },
      };
      healthCheckService.check.mockResolvedValue(unhealthyResult);

      // Act
      const result = await controller.check();

      // Assert
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
      expect(healthCheckService.check).toHaveBeenCalledWith([]);
    });

    it('should propagate health check service errors', async () => {
      // Arrange
      const error = new Error('Health check service error');
      healthCheckService.check.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.check()).rejects.toThrow(
        'Health check service error',
      );
      expect(healthCheckService.check).toHaveBeenCalledWith([]);
    });

    it('should handle timeout scenarios', async () => {
      // Arrange
      const timeoutResult: HealthCheckResult = {
        status: 'error',
        info: {},
        error: {
          timeout: {
            status: 'down',
            message: 'Health check timed out',
          },
        },
        details: {
          timeout: {
            status: 'down',
            message: 'Health check timed out',
          },
        },
      };
      healthCheckService.check.mockResolvedValue(timeoutResult);

      // Act
      const result = await controller.check();

      // Assert
      expect(result.status).toBe('error');
      expect(result.error?.timeout).toBeDefined();
    });

    it('should handle partial health check results', async () => {
      // Arrange
      const partialResult: HealthCheckResult = {
        status: 'error',
        info: {
          memory: {
            status: 'up',
            memoryUsage: '50%',
          },
        },
        error: {
          database: {
            status: 'down',
            message: 'Connection timeout',
          },
        },
        details: {
          memory: {
            status: 'up',
            memoryUsage: '50%',
          },
          database: {
            status: 'down',
            message: 'Connection timeout',
          },
        },
      };
      healthCheckService.check.mockResolvedValue(partialResult);

      // Act
      const result = await controller.check();

      // Assert
      expect(result.status).toBe('error');
      expect(result.info?.memory).toBeDefined();
      expect(result.error?.database).toBeDefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple concurrent health check requests', async () => {
      // Arrange
      healthCheckService.check.mockResolvedValue(mockHealthCheckResult);

      // Act
      const promises = Array(5)
        .fill(null)
        .map(() => controller.check());
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toEqual(mockHealthCheckResult);
      });
      expect(healthCheckService.check).toHaveBeenCalledTimes(5);
    });

    it('should handle health check with detailed service information', async () => {
      // Arrange
      const detailedResult: HealthCheckResult = {
        status: 'ok',
        info: {
          database: {
            status: 'up',
            connection: 'active',
            responseTime: '50ms',
          },
          storage: {
            status: 'up',
            diskSpace: '75% available',
          },
        },
        error: {},
        details: {
          database: {
            status: 'up',
            connection: 'active',
            responseTime: '50ms',
          },
          storage: {
            status: 'up',
            diskSpace: '75% available',
          },
        },
      };
      healthCheckService.check.mockResolvedValue(detailedResult);

      // Act
      const result = await controller.check();

      // Assert
      expect(result.status).toBe('ok');
      expect(result.info?.database).toBeDefined();
      expect(result.info?.storage).toBeDefined();
    });
  });
});
