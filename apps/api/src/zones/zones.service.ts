import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ZonesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all active zones with their tables
   */
  async findAll() {
    return this.prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
        },
      },
    });
  }

  /**
   * Get a zone by slug with tables
   */
  async findBySlug(slug: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { slug },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
        },
      },
    });
    if (!zone) throw new NotFoundException(`Zona '${slug}' no encontrada`);
    return zone;
  }

  /**
   * Get availability for a zone at a specific date+hour.
   * Returns zone with tables + which are occupied.
   */
  async getAvailability(slug: string, date: string, hour: string) {
    const zone = await this.findBySlug(slug);

    // Find all reservations for this zone/date/hour that are not cancelled
    const reservations = await this.prisma.reservation.findMany({
      where: {
        date: new Date(date),
        hour,
        status: { in: ['CONFIRMED', 'PENDING'] },
        tables: {
          some: {
            table: { zoneId: zone.id },
          },
        },
      },
      include: {
        tables: {
          include: { table: true },
        },
      },
    });

    // Build set of occupied table IDs
    const occupiedTableIds = new Set<string>();
    const occupiedMap: Record<string, string> = {}; // tableId -> reservation name

    for (const res of reservations) {
      for (const rt of res.tables) {
        occupiedTableIds.add(rt.tableId);
        occupiedMap[rt.table.code] = res.customerName;
      }
    }

    // Annotate tables with availability
    const tablesWithAvailability = zone.tables.map((table) => ({
      ...table,
      isOccupied: occupiedTableIds.has(table.id),
      reservedBy: occupiedMap[table.code] || null,
    }));

    return {
      ...zone,
      tables: tablesWithAvailability,
      stats: {
        total: zone.tables.length,
        occupied: occupiedTableIds.size,
        available: zone.tables.length - occupiedTableIds.size,
        totalSeatsAvailable: zone.tables
          .filter((t) => !occupiedTableIds.has(t.id))
          .reduce((sum, t) => sum + t.seats, 0),
      },
    };
  }
}
