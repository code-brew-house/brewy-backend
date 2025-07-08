import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtValidationService } from './services/jwt-validation.service';
import { SecurityLoggerService } from '../../common/services/security-logger.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * AuthModule handles user authentication operations including
 * registration, login, logout, and JWT token management.
 */
@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtValidationService,
    SecurityLoggerService,
    PrismaService,
  ],
  exports: [AuthService, JwtValidationService, SecurityLoggerService],
})
export class AuthModule {}
