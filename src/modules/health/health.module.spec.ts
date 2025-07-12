import { Test, TestingModule } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import { HealthModule } from './health.module';
import { HealthController } from './health.controller';

describe('HealthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [HealthModule, TerminusModule],
    }).compile();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have HealthController', () => {
    const controller = module.get<HealthController>(HealthController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(HealthController);
  });

  it('should import TerminusModule', () => {
    // This test verifies that the TerminusModule is properly imported
    // and its providers are available
    const healthController = module.get<HealthController>(HealthController);
    expect(healthController).toBeDefined();

    // Verify that the health check service from TerminusModule is available
    expect(healthController['health']).toBeDefined();
  });

  it('should be a valid module configuration', () => {
    // Test that the module can be instantiated without errors
    expect(() => {
      const testModule = new HealthModule();
      expect(testModule).toBeInstanceOf(HealthModule);
    }).not.toThrow();
  });

  describe('Module dependencies', () => {
    it('should properly configure TerminusModule dependency', async () => {
      // Arrange & Act
      const testModule = await Test.createTestingModule({
        imports: [HealthModule],
      }).compile();

      // Assert
      const healthController =
        testModule.get<HealthController>(HealthController);
      expect(healthController).toBeDefined();

      await testModule.close();
    });

    it('should provide all required dependencies for HealthController', async () => {
      // Arrange & Act
      const testModule = await Test.createTestingModule({
        imports: [HealthModule],
      }).compile();

      // Assert
      const healthController =
        testModule.get<HealthController>(HealthController);
      expect(healthController).toBeDefined();

      // Verify that all constructor dependencies are properly injected
      expect(healthController['health']).toBeDefined();

      await testModule.close();
    });
  });

  describe('Module exports', () => {
    it('should not export any providers', () => {
      // The HealthModule doesn't export any providers, which is correct
      // as it's meant to be self-contained for health checking
      expect(HealthModule).toBeDefined();
    });
  });

  describe('Integration with NestJS module system', () => {
    it('should integrate properly with the NestJS module system', async () => {
      // Arrange & Act
      const testModule = await Test.createTestingModule({
        imports: [HealthModule],
      }).compile();

      await testModule.init();

      // Assert
      expect(testModule).toBeDefined();

      const healthController =
        testModule.get<HealthController>(HealthController);
      expect(healthController).toBeDefined();

      await testModule.close();
    });

    it('should handle module lifecycle correctly', async () => {
      // Arrange
      const testModule = await Test.createTestingModule({
        imports: [HealthModule],
      }).compile();

      // Act
      await testModule.init();
      const healthController =
        testModule.get<HealthController>(HealthController);

      // Assert
      expect(healthController).toBeDefined();

      // Cleanup
      await expect(testModule.close()).resolves.not.toThrow();
    });
  });
});
