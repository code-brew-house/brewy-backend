import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageModule } from './modules/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { AudioAnalysisModule } from './modules/audio-analysis/audio-analysis.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { RateLimitExceptionFilter } from './common/filters/rate-limit-exception.filter';
import { AuthExceptionFilter } from './common/filters/auth-exception.filter';
import { SecurityLoggerService } from './common/services/security-logger.service';
import { ValidationLoggingInterceptor } from './common/interceptors/validation-logging.interceptor';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'general',
          ttl: parseInt(configService.get('RATE_LIMIT_GENERAL_TTL', '60000')),
          limit: parseInt(configService.get('RATE_LIMIT_GENERAL_MAX', '100')),
        },
        {
          name: 'auth',
          ttl: parseInt(configService.get('RATE_LIMIT_AUTH_TTL', '900000')),
          limit: parseInt(configService.get('RATE_LIMIT_AUTH_MAX', '5')),
        },
        {
          name: 'register',
          ttl: parseInt(configService.get('RATE_LIMIT_REGISTER_TTL', '600000')),
          limit: parseInt(configService.get('RATE_LIMIT_REGISTER_MAX', '3')),
        },
      ],
    }),
    StorageModule,
    HealthModule,
    AudioAnalysisModule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    SecurityLoggerService,
    {
      provide: APP_GUARD,
      useClass: RateLimitMiddleware,
    },
    {
      provide: APP_FILTER,
      useClass: RateLimitExceptionFilter,
    },
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
