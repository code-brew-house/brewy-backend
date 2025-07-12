import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AudioAnalysisModule } from './audio-analysis.module';
import { AudioAnalysisService } from './audio-analysis.service';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { JobStatus } from '../../../generated/prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';

describe('AudioAnalysis Integration Tests', () => {
  let app: INestApplication;

  const mockAudioAnalysisService = {
    uploadAndProcess: jest.fn(),
    getJobStatus: jest.fn(),
    getAnalysisResults: jest.fn(),
    processWebhookCallback: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  // Mock guards to bypass authentication for integration tests
  const mockGuard = {
    canActivate: jest.fn((context) => {
      const request = context.switchToHttp().getRequest();
      // Set up mock user context for controller
      request.user = {
        id: 'test-user-id',
        username: 'test-user',
        role: 'SUPER_OWNER', // Use SUPER_OWNER to bypass organization filtering
        organizationId: 'test-org-id',
      };
      request.organizationId = 'test-org-id';
      return true;
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AudioAnalysisModule],
    })
      .overrideProvider(AudioAnalysisService)
      .useValue(mockAudioAnalysisService)
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockGuard)
      .overrideGuard(OrganizationGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe to match real application setup
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /audio-analysis/upload', () => {
    const mockUploadResponse = {
      jobId: 'test-job-id',
      fileId: 'test-file-id',
      status: JobStatus.pending,
      message: 'File uploaded successfully, processing started',
    };

    it('should upload MP3 file successfully', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockResolvedValue(
        mockUploadResponse,
      );

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', Buffer.from('mock mp3 content'), 'test.mp3')
        .expect(201);

      expect(response.body).toEqual(mockUploadResponse);
      expect(mockAudioAnalysisService.uploadAndProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          originalname: 'test.mp3',
          mimetype: 'audio/mpeg',
        }),
        'test-org-id', // organizationId from mocked guard
      );
    });

    it('should reject request without file', async () => {
      const response = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .expect(400);

      expect(response.body.message).toBe('Audio file is required');
      expect(mockAudioAnalysisService.uploadAndProcess).not.toHaveBeenCalled();
    });

    it('should handle service errors appropriately', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('File size must be 20MB or less'),
      );

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', Buffer.from('mock mp3 content'), 'test.mp3')
        .expect(400);

      expect(response.body.message).toBe('File size exceeds 20MB limit');
    });

    it('should handle storage errors', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('Failed to upload to storage'),
      );

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', Buffer.from('mock mp3 content'), 'test.mp3')
        .expect(500);

      expect(response.body.message).toBe('Failed to store file');
    });

    it('should handle generic errors', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('Unknown error'),
      );

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', Buffer.from('mock mp3 content'), 'test.mp3')
        .expect(500);

      expect(response.body.message).toBe('Failed to process audio file');
    });
  });

  describe('GET /audio-analysis/jobs/:jobId', () => {
    const validJobId = '550e8400-e29b-41d4-a716-446655440000';
    const mockJobStatus = {
      id: validJobId,
      status: JobStatus.completed,
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-01T01:00:00Z'),
      startedAt: new Date('2023-01-01T00:05:00Z'),
      completedAt: new Date('2023-01-01T01:00:00Z'),
      error: null,
      file: {
        id: 'file-id',
        filename: 'test.mp3',
        size: 1024,
        mimetype: 'audio/mpeg',
      },
    };

    it('should return job status for valid UUID', async () => {
      mockAudioAnalysisService.getJobStatus.mockResolvedValue(mockJobStatus);

      const response = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${validJobId}`)
        .expect(200);

      expect(response.body).toEqual({
        ...mockJobStatus,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T01:00:00.000Z',
        startedAt: '2023-01-01T00:05:00.000Z',
        completedAt: '2023-01-01T01:00:00.000Z',
      });
      expect(mockAudioAnalysisService.getJobStatus).toHaveBeenCalledWith(
        validJobId,
        undefined, // organizationId filtered for mocked SUPER_OWNER
      );
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app.getHttpServer())
        .get('/audio-analysis/jobs/invalid-uuid')
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
      expect(mockAudioAnalysisService.getJobStatus).not.toHaveBeenCalled();
    });

    it('should return 404 when job is not found', async () => {
      mockAudioAnalysisService.getJobStatus.mockRejectedValue(
        new Error('Job with ID test-id not found'),
      );

      const response = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${validJobId}`)
        .expect(404);

      expect(response.body.message).toBe(`Job with ID ${validJobId} not found`);
    });

    it('should return 500 for service errors', async () => {
      mockAudioAnalysisService.getJobStatus.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const response = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${validJobId}`)
        .expect(500);

      expect(response.body.message).toBe('Failed to retrieve job status');
    });
  });

  describe('GET /audio-analysis/jobs/:jobId/results', () => {
    const validJobId = '550e8400-e29b-41d4-a716-446655440000';
    const mockAnalysisResults = {
      id: 'result-id',
      jobId: validJobId,
      transcript: 'This is a test transcript from the audio analysis.',
      sentiment: 'positive',
      metadata: {
        confidence: 0.95,
        duration: 120,
        language: 'en',
      },
      createdAt: new Date('2023-01-01T01:00:00Z'),
      job: {
        id: validJobId,
        status: JobStatus.completed,
        file: {
          filename: 'test.mp3',
          size: 1024,
        },
      },
    };

    it('should return analysis results for valid job ID', async () => {
      mockAudioAnalysisService.getAnalysisResults.mockResolvedValue(
        mockAnalysisResults,
      );

      const response = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${validJobId}/results`)
        .expect(200);

      expect(response.body).toEqual({
        ...mockAnalysisResults,
        createdAt: '2023-01-01T01:00:00.000Z',
      });
      expect(mockAudioAnalysisService.getAnalysisResults).toHaveBeenCalledWith(
        validJobId,
        undefined, // organizationId filtered for mocked SUPER_OWNER
      );
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app.getHttpServer())
        .get('/audio-analysis/jobs/invalid-uuid/results')
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
      expect(
        mockAudioAnalysisService.getAnalysisResults,
      ).not.toHaveBeenCalled();
    });

    it('should return 404 when analysis results are not found', async () => {
      mockAudioAnalysisService.getAnalysisResults.mockRejectedValue(
        new Error('Analysis result for job test-id not found'),
      );

      const response = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${validJobId}/results`)
        .expect(404);

      expect(response.body.message).toBe(
        `Analysis results for job ${validJobId} not found`,
      );
    });

    it('should return 500 for service errors', async () => {
      mockAudioAnalysisService.getAnalysisResults.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const response = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${validJobId}/results`)
        .expect(500);

      expect(response.body.message).toBe('Failed to retrieve analysis results');
    });
  });

  describe('POST /audio-analysis/webhook', () => {
    const validWebhookPayload = {
      jobId: 'test-job-id',
      status: 'completed',
      transcript: 'Test transcript from N8N',
      sentiment: 'positive',
      metadata: {
        confidence: 0.95,
        duration: 120,
      },
    };

    const expectedResponse = {
      success: true,
      message: 'Webhook processed successfully',
    };

    beforeEach(() => {
      mockConfigService.get.mockReturnValue('test-webhook-secret');
      mockAudioAnalysisService.processWebhookCallback.mockResolvedValue({
        success: true,
      });
    });

    it('should process webhook with valid payload and secret', async () => {
      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret')
        .send(validWebhookPayload)
        .expect(200);

      expect(response.body).toEqual(expectedResponse);
      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).toHaveBeenCalledWith(validWebhookPayload);
    });

    it('should process webhook with uppercase header', async () => {
      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('X-N8N-WEBHOOK-SECRET', 'test-webhook-secret')
        .send(validWebhookPayload)
        .expect(200);

      expect(response.body).toEqual(expectedResponse);
    });

    it('should reject webhook with invalid secret', async () => {
      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'wrong-secret')
        .send(validWebhookPayload)
        .expect(400);

      expect(response.body.message).toBe('Invalid webhook secret');
      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).not.toHaveBeenCalled();
    });

    it('should process webhook when no secret is configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .send(validWebhookPayload)
        .expect(200);

      expect(response.body).toEqual(expectedResponse);
    });

    it('should validate webhook payload and reject invalid data', async () => {
      const invalidPayload = {
        jobId: 'test-job-id',
        status: 'invalid-status', // Invalid enum value
      };

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('status must be one of the following values'),
        ]),
      );
      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).not.toHaveBeenCalled();
    });

    it('should reject webhook payload with missing required fields', async () => {
      const incompletePayload = {
        status: 'completed',
        // Missing jobId
      };

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret')
        .send(incompletePayload)
        .expect(400);

      expect(response.body.message).toContain('jobId must be a string');
      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).not.toHaveBeenCalled();
    });

    it('should handle failed webhook status', async () => {
      const failedWebhookPayload = {
        jobId: 'test-job-id',
        status: 'failed',
        error: 'Audio processing failed due to file corruption',
      };

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret')
        .send(failedWebhookPayload)
        .expect(200);

      expect(response.body).toEqual(expectedResponse);
      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).toHaveBeenCalledWith(failedWebhookPayload);
    });

    it('should return 404 when job is not found for webhook', async () => {
      mockAudioAnalysisService.processWebhookCallback.mockRejectedValue(
        new Error('Job not found'),
      );

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret')
        .send(validWebhookPayload)
        .expect(404);

      expect(response.body.message).toBe(
        'Job not found for webhook processing',
      );
    });

    it('should return 400 for validation errors from service', async () => {
      mockAudioAnalysisService.processWebhookCallback.mockRejectedValue(
        new Error('Missing required validation field'),
      );

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret')
        .send(validWebhookPayload)
        .expect(400);

      expect(response.body.message).toBe(
        'Invalid webhook payload: Missing required validation field',
      );
    });

    it('should return 500 for service errors', async () => {
      mockAudioAnalysisService.processWebhookCallback.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret')
        .send(validWebhookPayload)
        .expect(500);

      expect(response.body.message).toBe('Failed to process webhook callback');
    });

    it('should reject webhook payload with non-whitelisted fields', async () => {
      const payloadWithExtraFields = {
        ...validWebhookPayload,
        extraField: 'should be removed',
        anotherField: 123,
      };

      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret')
        .send(payloadWithExtraFields)
        .expect(400); // Should fail due to forbidNonWhitelisted: true

      expect(response.body.message).toContain(
        'property extraField should not exist',
      );
      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Content-Type handling', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('test-secret');
      mockAudioAnalysisService.processWebhookCallback.mockResolvedValue({
        success: true,
      });
    });

    it('should handle JSON content type for webhook', async () => {
      const response = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('Content-Type', 'application/json')
        .set('x-n8n-webhook-secret', 'test-secret')
        .send({
          jobId: 'test-job-id',
          status: 'completed',
          transcript: 'Test',
          sentiment: 'positive',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject non-JSON content for webhook', async () => {
      await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('Content-Type', 'text/plain')
        .set('x-n8n-webhook-secret', 'test-secret')
        .send('plain text data')
        .expect(400);

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).not.toHaveBeenCalled();
    });
  });
});
