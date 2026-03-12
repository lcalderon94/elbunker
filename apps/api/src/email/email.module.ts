import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  providers: [EmailService, PrismaService],
  exports: [EmailService],
})
export class EmailModule {}
