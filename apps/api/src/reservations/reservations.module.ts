import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '../common/prisma.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, PrismaService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
