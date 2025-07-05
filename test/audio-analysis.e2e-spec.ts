import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JobStatus } from '../generated/prisma';

describe('AudioAnalysisController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
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
          expect(res.body).toHaveProperty('transcript', 'This is a test transcript');
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
});