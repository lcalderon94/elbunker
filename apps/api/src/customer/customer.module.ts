// ============================================================
// src/customer/customer.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'elbunker-secret-2026'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [CustomerController],
  providers: [CustomerService, PrismaService],
  exports: [CustomerService, JwtModule],
})
export class CustomerModule {}
