import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma';

/**
 * PrismaService provides a singleton PrismaClient for NestJS DI and handles shutdown hooks.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', () => {
      app.close();
    });
  }
}
