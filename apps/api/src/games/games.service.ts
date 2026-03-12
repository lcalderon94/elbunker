import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';

interface GameFilters {
  search?: string;
  typeId?: number;
  players?: number;
  maxDifficulty?: number;
  maxDuration?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: GameFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 24;
    const skip = (page - 1) * limit;

    const where: Prisma.GameWhereInput = {
      isAvailable: true,
    };

    // Search by name
    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    // Filter by type
    if (filters.typeId) {
      where.types = { some: { typeId: filters.typeId } };
    }

    // Filter by player count
    if (filters.players) {
      where.playersMin = { lte: filters.players };
      where.playersMax = { gte: filters.players };
    }

    // Filter by difficulty
    if (filters.maxDifficulty !== undefined) {
      where.difficulty = { lte: filters.maxDifficulty };
    }

    // Filter by duration
    if (filters.maxDuration) {
      where.durationMin = { lte: filters.maxDuration };
    }

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          types: { include: { type: true } },
          categories: { include: { category: true } },
          mechanics: { include: { mechanic: true } },
        },
      }),
      this.prisma.game.count({ where }),
    ]);

    return {
      games: games.map((g) => ({
        id: g.id,
        name: g.name,
        imageUrl: g.imageUrl,
        playersMin: g.playersMin,
        playersMax: g.playersMax,
        playersBest: g.playersBest,
        durationMin: g.durationMin,
        durationMax: g.durationMax,
        ageMin: g.ageMin,
        difficulty: g.difficulty,
        location: g.location,
        types: g.types.map((t) => ({ id: t.type.id, name: t.type.name })),
        categories: g.categories.map((c) => ({ id: c.category.id, name: c.category.name })),
        mechanics: g.mechanics.map((m) => ({ id: m.mechanic.id, name: m.mechanic.name })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        types: { include: { type: true } },
        categories: { include: { category: true } },
        mechanics: { include: { mechanic: true } },
      },
    });
    if (!game) throw new NotFoundException('Juego no encontrado');

    return {
      ...game,
      types: game.types.map((t) => ({ id: t.type.id, name: t.type.name })),
      categories: game.categories.map((c) => ({ id: c.category.id, name: c.category.name })),
      mechanics: game.mechanics.map((m) => ({ id: m.mechanic.id, name: m.mechanic.name })),
    };
  }

  async getTypes() {
    return this.prisma.type.findMany({ orderBy: { name: 'asc' } });
  }

  async getCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async getMechanics() {
    return this.prisma.mechanic.findMany({ orderBy: { name: 'asc' } });
  }
}
