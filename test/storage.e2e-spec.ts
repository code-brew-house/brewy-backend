import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Storage API (e2e)', () => {
  let app: INestApplication;

  // Small valid MP3 header for test
  const mp3Buffer = Buffer.from([
    0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21, 0x54, 0x41,
    0x4c, 0x42, 0x00, 0x00, 0x00, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /storage/upload - should upload a valid mp3 (self-contained)', async () => {
    const res = await request(app.getHttpServer())
      .post('/storage/upload')
      .attach('file', mp3Buffer, {
        filename: 'test.mp3',
        contentType: 'audio/mpeg',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.filename).toBe('test.mp3');
    // Clean up
    const delRes = await request(app.getHttpServer()).delete(
      `/storage/${res.body.id}`,
    );
    expect(delRes.status).toBe(200);
    expect(delRes.body.id).toBe(res.body.id);
  });

  it('GET /storage - should list files (self-contained)', async () => {
    // Upload a file
    const uploadRes = await request(app.getHttpServer())
      .post('/storage/upload')
      .attach('file', mp3Buffer, {
        filename: 'list.mp3',
        contentType: 'audio/mpeg',
      });
    expect(uploadRes.status).toBe(201);
    const listId = uploadRes.body.id;
    // List files
    const res = await request(app.getHttpServer()).get('/storage');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find((f: any) => f.id === listId)).toBeTruthy();
    // Clean up
    const delRes = await request(app.getHttpServer()).delete(
      `/storage/${listId}`,
    );
    expect(delRes.status).toBe(200);
    expect(delRes.body.id).toBe(listId);
  });

  it('GET /storage/:id - should get file by id (self-contained)', async () => {
    // Upload a file
    const uploadRes = await request(app.getHttpServer())
      .post('/storage/upload')
      .attach('file', mp3Buffer, {
        filename: 'get.mp3',
        contentType: 'audio/mpeg',
      });
    expect(uploadRes.status).toBe(201);
    const getId = uploadRes.body.id;
    // Get file by id
    const res = await request(app.getHttpServer()).get(`/storage/${getId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(getId);
    // Clean up
    const delRes = await request(app.getHttpServer()).delete(
      `/storage/${getId}`,
    );
    expect(delRes.status).toBe(200);
    expect(delRes.body.id).toBe(getId);
  });

  it('PATCH /storage/:id - should update file metadata', async () => {
    // Upload a file
    const uploadRes = await request(app.getHttpServer())
      .post('/storage/upload')
      .attach('file', mp3Buffer, {
        filename: 'patch.mp3',
        contentType: 'audio/mpeg',
      });
    expect(uploadRes.status).toBe(201);
    const patchId = uploadRes.body.id;
    // Update file
    const res = await request(app.getHttpServer())
      .patch(`/storage/${patchId}`)
      .send({ filename: 'updated.mp3' });
    expect(res.status).toBe(200);
    expect(res.body.filename).toBe('updated.mp3');
    // Clean up
    const delRes = await request(app.getHttpServer()).delete(
      `/storage/${patchId}`,
    );
    expect(delRes.status).toBe(200);
    expect(delRes.body.id).toBe(patchId);
  });

  it('GET /storage/:id/presigned-url - should get presigned url (self-contained)', async () => {
    // Upload a file
    const uploadRes = await request(app.getHttpServer())
      .post('/storage/upload')
      .attach('file', mp3Buffer, {
        filename: 'presigned.mp3',
        contentType: 'audio/mpeg',
      });
    expect(uploadRes.status).toBe(201);
    const presignedId = uploadRes.body.id;
    // Get presigned url
    const res = await request(app.getHttpServer()).get(
      `/storage/${presignedId}/presigned-url`,
    );
    expect(res.status).toBe(200);
    expect(typeof res.body.url).toBe('string');
    // Delete the file
    const delRes = await request(app.getHttpServer()).delete(
      `/storage/${presignedId}`,
    );
    expect(delRes.status).toBe(200);
    expect(delRes.body.id).toBe(presignedId);
  });

  it('DELETE /storage/:id - should delete file (self-contained)', async () => {
    // Upload a file
    const uploadRes = await request(app.getHttpServer())
      .post('/storage/upload')
      .attach('file', mp3Buffer, {
        filename: 'delete.mp3',
        contentType: 'audio/mpeg',
      });
    expect(uploadRes.status).toBe(201);
    const delId = uploadRes.body.id;
    // Delete file
    const res = await request(app.getHttpServer()).delete(`/storage/${delId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(delId);
    // Confirm deletion
    const getRes = await request(app.getHttpServer()).get(`/storage/${delId}`);
    expect(getRes.status).toBe(404);
  });

  it('POST /storage/upload - should reject non-mp3 file', async () => {
    const res = await request(app.getHttpServer())
      .post('/storage/upload')
      .attach('file', Buffer.from([1, 2, 3]), {
        filename: 'bad.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(400);
  });

  it('POST /storage/upload - should reject file over 50MB', async () => {
    const bigBuffer = Buffer.alloc(51 * 1024 * 1024, 0x00);
    const res = await request(app.getHttpServer())
      .post('/storage/upload')
      .attach('file', bigBuffer, {
        filename: 'big.mp3',
        contentType: 'audio/mpeg',
      });
    expect(res.status).toBe(400);
  });

  describe('Error Handling and Edge Cases', () => {
    it('GET /storage/:id - should return 404 for non-existent file', async () => {
      const res = await request(app.getHttpServer()).get(
        '/storage/non-existent-id',
      );
      expect(res.status).toBe(404);
    });

    it('PATCH /storage/:id - should return 404 for non-existent file', async () => {
      const res = await request(app.getHttpServer())
        .patch('/storage/non-existent-id')
        .send({ filename: 'updated.mp3' });
      expect(res.status).toBe(404);
    });

    it('DELETE /storage/:id - should return 404 for non-existent file', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/storage/non-existent-id',
      );
      expect(res.status).toBe(404);
    });

    it('GET /storage/:id/presigned-url - should return 404 for non-existent file', async () => {
      const res = await request(app.getHttpServer()).get(
        '/storage/non-existent-id/presigned-url',
      );
      expect(res.status).toBe(404);
    });

    it('POST /storage/upload - should handle missing file', async () => {
      const res = await request(app.getHttpServer()).post('/storage/upload');
      expect(res.status).toBe(400);
    });

    it('POST /storage/upload - should reject empty file', async () => {
      const res = await request(app.getHttpServer())
        .post('/storage/upload')
        .attach('file', Buffer.alloc(0), {
          filename: 'empty.mp3',
          contentType: 'audio/mpeg',
        });
      expect(res.status).toBe(400);
    });

    it('PATCH /storage/:id - should handle validation with invalid fields', async () => {
      // Upload a file first
      const uploadRes = await request(app.getHttpServer())
        .post('/storage/upload')
        .attach('file', mp3Buffer, {
          filename: 'patch-test.mp3',
          contentType: 'audio/mpeg',
        });
      expect(uploadRes.status).toBe(201);
      const patchId = uploadRes.body.id;

      // Try to patch with invalid data - should succeed but ignore invalid fields
      const res = await request(app.getHttpServer())
        .patch(`/storage/${patchId}`)
        .send({ invalidField: 'invalid' });
      expect(res.status).toBe(200);

      // Clean up
      await request(app.getHttpServer()).delete(`/storage/${patchId}`);
    });
  });
});
