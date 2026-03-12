import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './common/prisma.service';
import { ZonesModule } from './zones/zones.module';
import { ReservationsModule } from './reservations/reservations.module';
import { EmailModule } from './email/email.module';
import { GamesModule } from './games/games.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ZonesModule,
    ReservationsModule,
    EmailModule,
    GamesModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
