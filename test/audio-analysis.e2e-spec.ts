import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JobStatus } from '../generated/prisma';

describe('Audio Analysis E2E - Complete Workflow Tests', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let configService: ConfigService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe to match real application
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    );

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    // Mock environment variables for testing
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      switch (key) {
        case 'N8N_WEBHOOK_URL':
          return 'https://n8n.example.com/webhook/test';
        case 'N8N_WEBHOOK_SECRET':
          return 'test-webhook-secret-123';
        default:
          return undefined;
      }
    });

    await app.init();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await prismaService.analysisResult.deleteMany({});
    await prismaService.job.deleteMany({});
    await prismaService.storage.deleteMany({});
  });

  afterAll(async () => {
    // Final cleanup
    await prismaService.analysisResult.deleteMany({});
    await prismaService.job.deleteMany({});
    await prismaService.storage.deleteMany({});
    await app.close();
  });

  describe('/audio-analysis (POST)', () => {
    it('should upload an MP3 file and create a job', () => {
      const mp3Buffer = Buffer.from('fake mp3 content');

      return request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', mp3Buffer, 'test.mp3')
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('jobId');
          expect(res.body).toHaveProperty('fileId');
          expect(res.body).toHaveProperty('status', 'pending');
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should reject non-MP3 files', () => {
      const txtBuffer = Buffer.from('not an mp3 file');

      return request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', txtBuffer, 'test.txt')
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Only MP3 files are allowed');
        });
    });

    it('should reject files larger than 20MB', () => {
      const largeMp3Buffer = Buffer.alloc(21 * 1024 * 1024); // 21MB

      return request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', largeMp3Buffer, 'large.mp3')
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('File size must be 20MB or less');
        });
    });

    it('should reject requests without file', () => {
      return request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('File is required');
        });
    });
  });

  describe('/audio-analysis/jobs/:jobId (GET)', () => {
    let jobId: string;
    let fileId: string;

    beforeAll(async () => {
      // Create test data
      const storageRecord = await prismaService.storage.create({
        data: {
          filename: 'test-e2e.mp3',
          url: 'https://example.com/test-e2e.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });
      fileId = storageRecord.id;

      const job = await prismaService.job.create({
        data: {
          fileId,
          status: JobStatus.processing,
          startedAt: new Date(),
        },
      });
      jobId = job.id;
    });

    it('should return job status', () => {
      return request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', jobId);
          expect(res.body).toHaveProperty('status', 'processing');
          expect(res.body).toHaveProperty('createdAt');
          expect(res.body).toHaveProperty('startedAt');
          expect(res.body).toHaveProperty('file');
          expect(res.body.file).toHaveProperty('filename', 'test-e2e.mp3');
        });
    });

    it('should return 404 for non-existent job', () => {
      return request(app.getHttpServer())
        .get('/audio-analysis/jobs/non-existent-job-id')
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });
  });

  describe('/audio-analysis/jobs/:jobId/results (GET)', () => {
    let jobId: string;
    let resultId: string;

    beforeAll(async () => {
      // Create test data
      const storageRecord = await prismaService.storage.create({
        data: {
          filename: 'test-results.mp3',
          url: 'https://example.com/test-results.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storageRecord.id,
          status: JobStatus.completed,
          completedAt: new Date(),
        },
      });
      jobId = job.id;

      const result = await prismaService.analysisResult.create({
        data: {
          jobId,
          transcript: 'This is a test transcript',
          sentiment: 'positive',
          metadata: { confidence: 0.95, words: 6 },
        },
      });
      resultId = result.id;
    });

    it('should return analysis results', () => {
      return request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}/results`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', resultId);
          expect(res.body).toHaveProperty('jobId', jobId);
          expect(res.body).toHaveProperty(
            'transcript',
            'This is a test transcript',
          );
          expect(res.body).toHaveProperty('sentiment', 'positive');
          expect(res.body).toHaveProperty('metadata');
          expect(res.body.metadata).toHaveProperty('confidence', 0.95);
          expect(res.body).toHaveProperty('job');
          expect(res.body.job).toHaveProperty('status', 'completed');
        });
    });

    it('should return 404 for job without results', async () => {
      // Create a job without results
      const storageRecord = await prismaService.storage.create({
        data: {
          filename: 'no-results.mp3',
          url: 'https://example.com/no-results.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const jobWithoutResults = await prismaService.job.create({
        data: {
          fileId: storageRecord.id,
          status: JobStatus.pending,
        },
      });

      return request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobWithoutResults.id}/results`)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });
  });

  describe('/audio-analysis/webhook (POST)', () => {
    let jobId: string;

    beforeAll(async () => {
      // Create test job
      const storageRecord = await prismaService.storage.create({
        data: {
          filename: 'webhook-test.mp3',
          url: 'https://example.com/webhook-test.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storageRecord.id,
          status: JobStatus.processing,
        },
      });
      jobId = job.id;
    });

    it('should process completed webhook callback', () => {
      const webhookData = {
        jobId,
        status: 'completed',
        transcript: 'Webhook test transcript',
        sentiment: 'neutral',
        metadata: { confidence: 0.88 },
      };

      return request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .send(webhookData)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
        });
    });

    it('should process failed webhook callback', async () => {
      // Create another job for failure test
      const storageRecord = await prismaService.storage.create({
        data: {
          filename: 'failed-test.mp3',
          url: 'https://example.com/failed-test.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storageRecord.id,
          status: JobStatus.processing,
        },
      });

      const webhookData = {
        jobId: job.id,
        status: 'failed',
        error: 'Processing failed due to invalid audio format',
      };

      return request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .send(webhookData)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
        });
    });

    it('should reject webhook with invalid data', () => {
      const invalidWebhookData = {
        jobId: 'invalid-job-id',
        status: 'invalid-status',
      };

      return request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .send(invalidWebhookData)
        .expect(400);
    });
  });

  describe('Complete Audio Analysis Workflow', () => {
    it('should handle complete successful workflow from upload to results', async () => {
      // Step 1: Upload audio file
      const uploadResponse = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach(
          'file',
          Buffer.from('comprehensive test mp3 content'),
          'workflow-test.mp3',
        )
        .expect(201);

      expect(uploadResponse.body).toMatchObject({
        jobId: expect.any(String),
        fileId: expect.any(String),
        status: 'pending',
        message: 'File uploaded successfully, processing started',
      });

      const { jobId, fileId } = uploadResponse.body;

      // Step 2: Verify job was created in database
      const createdJob = await prismaService.job.findUnique({
        where: { id: jobId },
        include: { storage: true },
      });

      expect(createdJob).toBeTruthy();
      expect(createdJob?.status).toBe(JobStatus.pending);
      expect(createdJob?.fileId).toBe(fileId);

      // Step 3: Check initial job status
      const initialStatusResponse = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}`)
        .expect(200);

      expect(initialStatusResponse.body).toMatchObject({
        id: jobId,
        status: 'pending',
        file: {
          id: fileId,
          filename: 'workflow-test.mp3',
          mimetype: 'audio/mpeg',
        },
      });

      // Step 4: Simulate N8N webhook callback with completed status
      const webhookPayload = {
        jobId,
        status: 'completed',
        transcript: 'This is a comprehensive end-to-end test transcript.',
        sentiment: 'positive',
        metadata: {
          confidence: 0.95,
          duration: 180,
          language: 'en',
          keywords: ['comprehensive', 'test', 'transcript'],
          emotions: {
            joy: 0.7,
            neutral: 0.3,
          },
        },
      };

      const webhookResponse = await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret-123')
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });

      // Step 5: Verify job status is now completed
      const completedStatusResponse = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}`)
        .expect(200);

      expect(completedStatusResponse.body).toMatchObject({
        id: jobId,
        status: 'completed',
        completedAt: expect.any(String),
      });

      // Step 6: Retrieve and verify analysis results
      const resultsResponse = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}/results`)
        .expect(200);

      expect(resultsResponse.body).toMatchObject({
        id: expect.any(String),
        jobId,
        transcript: webhookPayload.transcript,
        sentiment: webhookPayload.sentiment,
        metadata: webhookPayload.metadata,
        createdAt: expect.any(String),
        job: {
          id: jobId,
          status: 'completed',
          file: {
            filename: 'workflow-test.mp3',
          },
        },
      });

      // Step 7: Verify final database state
      const finalJob = await prismaService.job.findUnique({
        where: { id: jobId },
        include: { storage: true, results: true },
      });

      expect(finalJob).toBeTruthy();
      expect(finalJob?.status).toBe(JobStatus.completed);
      expect(finalJob?.results).toHaveLength(1);
      expect(finalJob?.results[0].transcript).toBe(webhookPayload.transcript);
    });

    it('should handle failed workflow with proper error reporting', async () => {
      // Upload file
      const uploadResponse = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach(
          'file',
          Buffer.from('failed test content'),
          'failed-workflow.mp3',
        )
        .expect(201);

      const { jobId } = uploadResponse.body;

      // Simulate failed N8N webhook
      const failedWebhookPayload = {
        jobId,
        status: 'failed',
        error: 'Audio processing failed due to corrupted file format',
      };

      await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret-123')
        .send(failedWebhookPayload)
        .expect(200);

      // Verify job status shows failure
      const statusResponse = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}`)
        .expect(200);

      expect(statusResponse.body).toMatchObject({
        id: jobId,
        status: 'failed',
        error: failedWebhookPayload.error,
        completedAt: expect.any(String),
      });

      // Verify no results exist
      await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}/results`)
        .expect(404);

      // Verify database state
      const failedJob = await prismaService.job.findUnique({
        where: { id: jobId },
        include: { results: true },
      });

      expect(failedJob).toBeTruthy();
      expect(failedJob?.status).toBe(JobStatus.failed);
      expect(failedJob?.error).toBe(failedWebhookPayload.error);
      expect(failedJob?.results).toHaveLength(0);
    });

    it('should handle multiple concurrent uploads and processing', async () => {
      const fileNames = [
        'concurrent1.mp3',
        'concurrent2.mp3',
        'concurrent3.mp3',
      ];
      const uploadPromises = [];

      // Upload multiple files concurrently
      for (const fileName of fileNames) {
        const uploadPromise = request(app.getHttpServer())
          .post('/audio-analysis/upload')
          .attach('file', Buffer.from(`content for ${fileName}`), fileName);
        uploadPromises.push(uploadPromise);
      }

      const uploadResponses = await Promise.all(uploadPromises);

      // Verify all uploads succeeded
      uploadResponses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.jobId).toBeDefined();
        expect(response.body.status).toBe('pending');
      });

      const jobIds = uploadResponses.map((response) => response.body.jobId);

      // Process webhooks for all jobs
      for (let i = 0; i < jobIds.length; i++) {
        const webhookPayload = {
          jobId: jobIds[i],
          status: 'completed',
          transcript: `Transcript for ${fileNames[i]} - concurrent processing test`,
          sentiment: i % 2 === 0 ? 'positive' : 'negative',
          metadata: {
            confidence: 0.9 - i * 0.1,
            fileIndex: i,
            concurrentTest: true,
          },
        };

        await request(app.getHttpServer())
          .post('/audio-analysis/webhook')
          .set('x-n8n-webhook-secret', 'test-webhook-secret-123')
          .send(webhookPayload)
          .expect(200);
      }

      // Verify all jobs completed successfully
      for (let i = 0; i < jobIds.length; i++) {
        const statusResponse = await request(app.getHttpServer())
          .get(`/audio-analysis/jobs/${jobIds[i]}`)
          .expect(200);

        expect(statusResponse.body.status).toBe('completed');

        const resultsResponse = await request(app.getHttpServer())
          .get(`/audio-analysis/jobs/${jobIds[i]}/results`)
          .expect(200);

        expect(resultsResponse.body.transcript).toContain(fileNames[i]);
        expect(resultsResponse.body.metadata.concurrentTest).toBe(true);
      }

      // Verify database consistency
      const allJobs = await prismaService.job.findMany({
        where: { id: { in: jobIds } },
        include: { results: true },
      });

      expect(allJobs).toHaveLength(3);
      allJobs.forEach((job) => {
        expect(job.status).toBe(JobStatus.completed);
        expect(job?.results).toHaveLength(1);
      });
    });

    it('should prevent duplicate result creation for same job', async () => {
      // Upload file
      const uploadResponse = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach(
          'file',
          Buffer.from('duplicate test content'),
          'duplicate-test.mp3',
        )
        .expect(201);

      const { jobId } = uploadResponse.body;

      const webhookPayload = {
        jobId,
        status: 'completed',
        transcript: 'Original transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95, version: 1 },
      };

      // Send first webhook
      await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret-123')
        .send(webhookPayload)
        .expect(200);

      // Send duplicate webhook with different data
      const duplicatePayload = {
        ...webhookPayload,
        transcript: 'Modified transcript',
        sentiment: 'negative',
        metadata: { confidence: 0.85, version: 2 },
      };

      await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret-123')
        .send(duplicatePayload)
        .expect(200);

      // Verify only original result exists
      const resultsResponse = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}/results`)
        .expect(200);

      expect(resultsResponse.body.transcript).toBe('Original transcript');
      expect(resultsResponse.body.sentiment).toBe('positive');
      expect(resultsResponse.body.metadata.version).toBe(1);

      // Verify database has only one result
      const job = await prismaService.job.findUnique({
        where: { id: jobId },
        include: { results: true },
      });

      expect(job).toBeTruthy();
      expect(job?.results).toHaveLength(1);
    });

    it('should handle large metadata objects in webhook processing', async () => {
      const uploadResponse = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach(
          'file',
          Buffer.from('large metadata test'),
          'large-metadata.mp3',
        )
        .expect(201);

      const { jobId } = uploadResponse.body;

      // Create large metadata object
      const largeMetadata = {
        confidence: 0.95,
        duration: 600,
        language: 'en',
        chapters: Array.from({ length: 20 }, (_, i) => ({
          start: i * 30,
          end: (i + 1) * 30,
          title: `Chapter ${i + 1}`,
          summary: `Detailed summary of chapter ${i + 1} with comprehensive information about the content`,
        })),
        keywords: Array.from({ length: 100 }, (_, i) => `keyword${i + 1}`),
        speakers: [
          {
            id: 1,
            name: 'Primary Speaker',
            segments: Array.from({ length: 10 }, (_, i) => ({
              start: i * 60,
              end: (i + 1) * 60,
            })),
          },
          {
            id: 2,
            name: 'Secondary Speaker',
            segments: Array.from({ length: 5 }, (_, i) => ({
              start: 300 + i * 60,
              end: 300 + (i + 1) * 60,
            })),
          },
        ],
        emotions: {
          joy: 0.4,
          sadness: 0.1,
          anger: 0.05,
          fear: 0.05,
          surprise: 0.1,
          neutral: 0.3,
        },
        topics: Array.from({ length: 25 }, (_, i) => ({
          name: `Topic ${i + 1}`,
          confidence: 0.9 - i * 0.01,
          timeranges: [{ start: i * 20, end: (i + 1) * 20 }],
        })),
      };

      const webhookPayload = {
        jobId,
        status: 'completed',
        transcript:
          'Test transcript with very large metadata object for comprehensive testing',
        sentiment: 'positive',
        metadata: largeMetadata,
      };

      await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret-123')
        .send(webhookPayload)
        .expect(200);

      const resultsResponse = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}/results`)
        .expect(200);

      expect(resultsResponse.body.metadata).toEqual(largeMetadata);
      expect(resultsResponse.body.metadata.chapters).toHaveLength(20);
      expect(resultsResponse.body.metadata.keywords).toHaveLength(100);
      expect(resultsResponse.body.metadata.topics).toHaveLength(25);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle webhook with missing required fields for completed status', async () => {
      const uploadResponse = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', Buffer.from('incomplete test'), 'incomplete.mp3')
        .expect(201);

      const { jobId } = uploadResponse.body;

      // Send webhook with missing transcript
      const incompletePayload = {
        jobId,
        status: 'completed',
        sentiment: 'positive',
        // Missing transcript
      };

      await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret-123')
        .send(incompletePayload)
        .expect(400);

      // Verify job status shows failed due to incomplete webhook
      const statusResponse = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('failed');
      expect(statusResponse.body.error).toContain(
        'Missing transcript or sentiment',
      );
    });

    it('should validate webhook authentication with various header formats', async () => {
      const uploadResponse = await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', Buffer.from('auth test'), 'auth-test.mp3')
        .expect(201);

      const { jobId } = uploadResponse.body;

      const webhookPayload = {
        jobId,
        status: 'completed',
        transcript: 'Test transcript',
        sentiment: 'positive',
      };

      // Test with wrong secret
      await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'wrong-secret')
        .send(webhookPayload)
        .expect(400);

      // Test with no secret header
      await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .send(webhookPayload)
        .expect(400);

      // Test with correct secret in uppercase header
      await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('X-N8N-WEBHOOK-SECRET', 'test-webhook-secret-123')
        .send(webhookPayload)
        .expect(200);

      // Verify job processed successfully
      const statusResponse = await request(app.getHttpServer())
        .get(`/audio-analysis/jobs/${jobId}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('completed');
    });

    it('should handle webhook for non-existent job', async () => {
      const webhookPayload = {
        jobId: 'non-existent-job-id',
        status: 'completed',
        transcript: 'Test transcript',
        sentiment: 'positive',
      };

      await request(app.getHttpServer())
        .post('/audio-analysis/webhook')
        .set('x-n8n-webhook-secret', 'test-webhook-secret-123')
        .send(webhookPayload)
        .expect(404);
    });

    it('should validate UUID format for job parameters', async () => {
      await request(app.getHttpServer())
        .get('/audio-analysis/jobs/invalid-uuid-format')
        .expect(400);

      await request(app.getHttpServer())
        .get('/audio-analysis/jobs/invalid-uuid-format/results')
        .expect(400);
    });

    it('should handle various file upload edge cases', async () => {
      // Test with empty file
      await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', Buffer.alloc(0), 'empty.mp3')
        .expect(400);

      // Test with file having MP3 extension but wrong mimetype
      await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', Buffer.from('not really mp3'), 'fake.mp3')
        .set('Content-Type', 'multipart/form-data')
        .expect(201); // Should pass due to .mp3 extension

      // Test with very large file (over 20MB limit)
      const largeBuffer = Buffer.alloc(21 * 1024 * 1024); // 21MB
      await request(app.getHttpServer())
        .post('/audio-analysis/upload')
        .attach('file', largeBuffer, 'large.mp3')
        .expect(400);
    });
  });
});
