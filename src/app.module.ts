import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageModule } from './modules/storage/storage.module';
import { PrismaService } from './prisma/prisma.service';
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), StorageModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
