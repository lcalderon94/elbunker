import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

// Convert "18:00" → 18
function hourToNum(h: string): number {
  return parseInt(h.split(':')[0], 10);
}

// Do two time windows [aStart, aStart+aDur) and [bStart, bStart+bDur) overlap?
function overlaps(aStart: number, aDur: number, bStart: number, bDur: number): boolean {
  return aStart < bStart + bDur && aStart + aDur > bStart;
}

@Injectable()
export class ZonesService {
  constructor(private prisma: PrismaService) {}

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
   * Takes into account reservation DURATION so that overlapping reservations
   * are correctly detected.
   *
   * @param slug      Zone slug
   * @param date      ISO date string e.g. "2026-09-11"
   * @param hour      Hour string e.g. "18:00"
   * @param duration  How long the new reservation would last (default 2h).
   *                  Used to also detect conflicts from existing reservations
   *                  that started before this hour.
   */
  async getAvailability(slug: string, date: string, hour: string, duration = 2) {
    const zone = await this.findBySlug(slug);
    const queryHour = hourToNum(hour);

    // Find ALL reservations on this date for this zone (not cancelled)
    const reservations = await this.prisma.reservation.findMany({
      where: {
        date: new Date(date),
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

    // Build set of occupied table IDs (considering duration overlap)
    const occupiedTableIds = new Set<string>();
    const occupiedMap: Record<string, { name: string; hour: string; duration: number }> = {};

    for (const res of reservations) {
      const resHour = hourToNum(res.hour);
      const resDuration = (res as any).duration ?? 2;

      // Does this existing reservation overlap with the requested window?
      if (overlaps(resHour, resDuration, queryHour, duration)) {
        for (const rt of res.tables) {
          occupiedTableIds.add(rt.tableId);
          occupiedMap[rt.table.code] = {
            name: res.customerName,
            hour: res.hour,
            duration: resDuration,
          };
        }
      }
    }

    const tablesWithAvailability = zone.tables.map((table) => ({
      ...table,
      isOccupied: occupiedTableIds.has(table.id),
      reservedBy: occupiedMap[table.code]?.name || null,
      reservedAt: occupiedMap[table.code]?.hour || null,
      reservedDuration: occupiedMap[table.code]?.duration || null,
    }));

    const freeCount = zone.tables.length - occupiedTableIds.size;

    return {
      ...zone,
      tables: tablesWithAvailability,
      stats: {
        total: zone.tables.length,
        occupied: occupiedTableIds.size,
        available: freeCount,
        totalSeatsAvailable: zone.tables
          .filter((t) => !occupiedTableIds.has(t.id))
          .reduce((sum, t) => sum + t.seats, 0),
      },
    };
  }
}
