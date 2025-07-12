import { Test, TestingModule } from '@nestjs/testing';
import { AudioAnalysisWebhookController } from './audio-analysis-webhook.controller';
import { AudioAnalysisService } from './audio-analysis.service';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('AudioAnalysisWebhookController', () => {
  let controller: AudioAnalysisWebhookController;

  const mockAudioAnalysisService = {
    processWebhookCallback: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AudioAnalysisWebhookController],
      providers: [
        {
          provide: AudioAnalysisService,
          useValue: mockAudioAnalysisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<AudioAnalysisWebhookController>(
      AudioAnalysisWebhookController,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    const mockWebhookData = {
      jobId: 'job-id',
      status: 'completed' as const,
      transcript: 'Test transcript',
      sentiment: 'positive',
      metadata: { confidence: 0.95 },
    };

    const mockHeaders = {
      'x-n8n-webhook-secret': 'test-secret',
    };

    const expectedResponse = {
      success: true,
      message: 'Webhook processed successfully',
    };

    beforeEach(() => {
      mockConfigService.get.mockReturnValue('test-secret');
      mockAudioAnalysisService.processWebhookCallback.mockResolvedValue({
        success: true,
      });
    });

    it('should process webhook callback successfully', async () => {
      const result = await controller.processWebhook(
        mockWebhookData,
        mockHeaders,
      );

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).toHaveBeenCalledWith(mockWebhookData);
      expect(result).toEqual(expectedResponse);
    });

    it('should process webhook callback with uppercase header', async () => {
      const uppercaseHeaders = {
        'X-N8N-WEBHOOK-SECRET': 'test-secret',
      };

      const result = await controller.processWebhook(
        mockWebhookData,
        uppercaseHeaders,
      );

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).toHaveBeenCalledWith(mockWebhookData);
      expect(result).toEqual(expectedResponse);
    });

    it('should throw BadRequestException with invalid webhook secret', async () => {
      const invalidHeaders = {
        'x-n8n-webhook-secret': 'wrong-secret',
      };

      await expect(
        controller.processWebhook(mockWebhookData, invalidHeaders),
      ).rejects.toThrow(new BadRequestException('Invalid webhook secret'));

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).not.toHaveBeenCalled();
    });

    it('should process webhook when no secret is configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await controller.processWebhook(mockWebhookData, {});

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).toHaveBeenCalledWith(mockWebhookData);
      expect(result).toEqual(expectedResponse);
    });

    it('should throw NotFoundException when job is not found', async () => {
      mockAudioAnalysisService.processWebhookCallback.mockRejectedValue(
        new Error('Job not found'),
      );

      await expect(
        controller.processWebhook(mockWebhookData, mockHeaders),
      ).rejects.toThrow(
        new NotFoundException('Job not found for webhook processing'),
      );
    });

    it('should throw BadRequestException for validation errors', async () => {
      mockAudioAnalysisService.processWebhookCallback.mockRejectedValue(
        new Error('Missing required validation field'),
      );

      await expect(
        controller.processWebhook(mockWebhookData, mockHeaders),
      ).rejects.toThrow(
        new BadRequestException(
          'Invalid webhook payload: Missing required validation field',
        ),
      );
    });

    it('should handle generic errors from service', async () => {
      mockAudioAnalysisService.processWebhookCallback.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.processWebhook(mockWebhookData, mockHeaders),
      ).rejects.toThrow(
        new InternalServerErrorException('Failed to process webhook callback'),
      );
    });

    it('should process failed webhook callback', async () => {
      const failedWebhookData = {
        jobId: 'job-id',
        status: 'failed' as const,
        error: 'Processing failed',
      };

      const result = await controller.processWebhook(
        failedWebhookData,
        mockHeaders,
      );

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).toHaveBeenCalledWith(failedWebhookData);
      expect(result).toEqual(expectedResponse);
    });
  });
});
