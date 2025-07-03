import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class R2StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('R2_BUCKET_NAME', '');
    this.endpoint = this.configService.get<string>('R2_ENDPOINT_URL', '');
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.configService.get<string>('R2_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>(
          'R2_SECRET_ACCESS_KEY',
          '',
        ),
      },
    });
  }

  /**
   * Uploads a file stream to R2 storage using the recommended Upload utility.
   * @param key The storage key (filename)
   * @param stream The file stream (Readable)
   * @param mimetype The MIME type of the file
   * @returns The public URL of the uploaded file
   */
  async uploadFile(
    key: string,
    stream: Readable,
    mimetype: string,
  ): Promise<string> {
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentType: mimetype,
      },
    });

    await upload.done();
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  /**
   * Downloads a file from R2 storage.
   */
  async downloadFile(key: string) {
    return this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /**
   * Deletes a file from R2 storage.
   */
  async deleteFile(key: string) {
    return this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /**
   * Generates a presigned URL for accessing a file in R2 storage.
   */
  async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }
}
