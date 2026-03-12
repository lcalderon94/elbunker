// ============================================================
// games.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [GamesController],
  providers: [GamesService, PrismaService],
  exports: [GamesService],
})
export class GamesModule {}
