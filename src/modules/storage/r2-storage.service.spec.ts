import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { R2StorageService } from './r2-storage.service';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

describe('R2StorageService (integration)', () => {
  let service: R2StorageService;
  const testKey = `test/${randomUUID()}.txt`;
  const testContent = Buffer.from('Hello R2!');
  const testMime = 'text/plain';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [R2StorageService],
    }).compile();
    service = module.get<R2StorageService>(R2StorageService);
  });

  it('should upload, download, generate presigned URL, and delete a file', async () => {
    // Upload
    const url = await service.uploadFile(
      testKey,
      Readable.from(testContent),
      testMime,
    );
    expect(url).toContain(testKey);

    // Presigned URL
    const presigned = await service.getPresignedUrl(testKey, 60);
    expect(typeof presigned).toBe('string');
    // Optionally log: console.log('Presigned URL:', presigned);

    // Download
    const result = await service.downloadFile(testKey);
    expect(result.Body).toBeDefined();

    // Delete
    await service.deleteFile(testKey);
    // Should not throw
  });
});
