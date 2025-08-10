import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageModule } from './modules/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { AudioAnalysisModule } from './modules/audio-analysis/audio-analysis.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PrismaService } from './prisma/prisma.service';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { AuthExceptionFilter } from './common/filters/auth-exception.filter';
import { SecurityLoggerService } from './common/services/security-logger.service';
import { ValidationLoggingInterceptor } from './common/interceptors/validation-logging.interceptor';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    StorageModule,
    HealthModule,
    AudioAnalysisModule,
    UserModule,
    AuthModule,
    OrganizationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    SecurityLoggerService,
    {
      provide: APP_FILTER,
      useClass: AuthExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ValidationLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityHeadersMiddleware).forRoutes('*');
  }
}
