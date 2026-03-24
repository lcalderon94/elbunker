import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateReservationDto, SpecialRequestDto } from './dto/reservation.dto';
import { randomBytes } from 'crypto';

const VALID_HOURS = [
  '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
];

// Convert "18:00" → 18
function hourToNum(h: string): number {
  return parseInt(h.split(':')[0], 10);
}

// Do two time windows overlap?
function overlaps(aStart: number, aDur: number, bStart: number, bDur: number): boolean {
  return aStart < bStart + bDur && aStart + aDur > bStart;
}

// Get day of week (0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat) from ISO date string
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getDay();
}

// Max allowed duration based on day
function maxDurationForDay(dateStr: string): number {
  const dow = getDayOfWeek(dateStr);
  // Fri(5), Sat(6), Sun(0) → 4h; Mon(1)-Thu(4) → 5h
  return [0, 5, 6].includes(dow) ? 4 : 5;
}

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(dto: CreateReservationDto) {
    // 1. Validate hour
    if (!VALID_HOURS.includes(dto.hour)) {
      throw new BadRequestException(`Hora '${dto.hour}' no es válida`);
    }

    // 2. Validate date is not in the past
    const reservationDate = new Date(dto.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (reservationDate < today) {
      throw new BadRequestException('No se puede reservar en una fecha pasada');
    }

    // 3. Validate duration
    const duration = dto.duration ?? 2;
    const maxDuration = maxDurationForDay(dto.date);
    if (duration < 1 || duration > maxDuration) {
      throw new BadRequestException(
        `La duración para este día es de 1 a ${maxDuration} horas`,
      );
    }

    // 4. Validate the reservation doesn't go past closing time
    const startHour = hourToNum(dto.hour);
    const endHour = startHour + duration;
    // Closing hours: Mon-Thu 23, Fri 24(00), Sat 24(00), Sun 22
    const dow = getDayOfWeek(dto.date);
    const closingHours: Record<number, number> = { 0: 22, 1: 23, 2: 23, 3: 23, 4: 23, 5: 24, 6: 24 };
    const closingHour = closingHours[dow] ?? 23;
    if (endHour > closingHour) {
      throw new BadRequestException(
        `Con ${duration}h desde las ${dto.hour} la reserva terminaría a las ${endHour}:00, ` +
        `pero el local cierra a las ${closingHour === 24 ? '00:00' : closingHour + ':00'}`,
      );
    }

    // 5. Transaction
    const reservation = await this.prisma.$transaction(async (tx) => {
      const zone = await tx.zone.findUnique({
        where: { slug: dto.zoneSlug },
        include: { tables: true },
      });
      if (!zone) throw new NotFoundException(`Zona '${dto.zoneSlug}' no encontrada`);

      const tables = zone.tables.filter((t) => dto.tableCodes.includes(t.code));
      if (tables.length !== dto.tableCodes.length) {
        const found = tables.map((t) => t.code);
        const missing = dto.tableCodes.filter((c) => !found.includes(c));
        throw new BadRequestException(`Mesas no encontradas: ${missing.join(', ')}`);
      }

      // Validate adjacency for combined tables
      if (tables.length > 1) {
        for (let i = 1; i < tables.length; i++) {
          const isAdj = tables.slice(0, i).some((prev) =>
            tables[i].adjacentIds.includes(prev.code),
          );
          if (!isAdj) {
            throw new BadRequestException(
              `Mesa ${tables[i].code} no es adyacente a las demás. Solo puedes combinar mesas contiguas.`,
            );
          }
        }
      }

      // Validate capacity
      const totalSeats = tables.reduce((sum, t) => sum + t.seats, 0);
      if (totalSeats < dto.people) {
        throw new BadRequestException(
          `Las mesas seleccionadas tienen ${totalSeats} plazas, pero necesitas ${dto.people}`,
        );
      }

      // Check conflicts — overlap-aware
      const tableIds = tables.map((t) => t.id);
      const existingReservations = await tx.reservation.findMany({
        where: {
          date: reservationDate,
          status: { in: ['CONFIRMED', 'PENDING'] },
          tables: { some: { tableId: { in: tableIds } } },
        },
        include: { tables: { include: { table: true } } },
      });

      const conflictCodes: string[] = [];
      for (const existing of existingReservations) {
        const existHour = hourToNum(existing.hour);
        const existDuration = (existing as any).duration ?? 2;
        if (overlaps(existHour, existDuration, startHour, duration)) {
          for (const rt of existing.tables) {
            if (tableIds.includes(rt.tableId)) {
              conflictCodes.push(rt.table.code);
            }
          }
        }
      }

      if (conflictCodes.length > 0) {
        const unique = [...new Set(conflictCodes)];
        throw new ConflictException(
          `Las siguientes mesas ya están reservadas en ese horario: ${unique.join(', ')}`,
        );
      }

      // Create reservation
      const cancelToken = randomBytes(32).toString('hex');
      const newReservation = await tx.reservation.create({
        data: {
          date: reservationDate,
          hour: dto.hour,
          duration,
          people: dto.people,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          eventType: dto.eventType,
          notes: dto.notes,
          isCombined: tables.length > 1,
          cancelToken,
          tables: {
            create: tableIds.map((tableId) => ({ tableId })),
          },
        },
        include: {
          tables: { include: { table: { include: { zone: true } } } },
        },
      });

      return newReservation;
    });

    // 6. Send emails
    try {
      await this.emailService.sendReservationConfirmation(reservation);
      await this.emailService.notifyStaffNewReservation(reservation);
    } catch (error) {
      console.error('Error sending email:', error);
    }

    const endHourStr = `${(startHour + duration).toString().padStart(2, '0')}:00`;

    return {
      id: reservation.id,
      date: reservation.date,
      hour: reservation.hour,
      duration,
      endHour: endHourStr,
      people: reservation.people,
      status: reservation.status,
      tables: reservation.tables.map((rt) => ({
        code: rt.table.code,
        label: rt.table.label,
        seats: rt.table.seats,
        zone: rt.table.zone.name,
      })),
      totalSeats: reservation.tables.reduce((s, rt) => s + rt.table.seats, 0),
      isCombined: reservation.isCombined,
      cancelToken: reservation.cancelToken,
      message: `¡Reserva confirmada de ${dto.hour} a ${endHourStr}! Te hemos enviado un email de confirmación.`,
    };
  }

  async createSpecialRequest(dto: SpecialRequestDto) {
    if (!VALID_HOURS.includes(dto.hour)) {
      throw new BadRequestException(`Hora '${dto.hour}' no es válida`);
    }

    const zone = await this.prisma.zone.findUnique({ where: { slug: dto.zoneSlug } });
    if (!zone) throw new NotFoundException(`Zona '${dto.zoneSlug}' no encontrada`);

    const duration = dto.duration ?? 2;
    const cancelToken = randomBytes(32).toString('hex');
    const reservation = await this.prisma.reservation.create({
      data: {
        date: new Date(dto.date),
        hour: dto.hour,
        duration,
        people: dto.people,
        status: 'PENDING',
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
        eventType: dto.eventType,
        notes: dto.notes,
        isSpecialRequest: true,
        cancelToken,
      },
    });

    try {
      await this.emailService.notifyStaffSpecialRequest(reservation, zone.name);
    } catch (error) {
      console.error('Error sending special request email:', error);
    }

    return {
      id: reservation.id,
      status: 'PENDING',
      message:
        'Solicitud recibida. Nuestro equipo valorará si es posible y te contactará por email.',
    };
  }

  async findById(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        tables: { include: { table: { include: { zone: true } } } },
      },
    });
    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    return reservation;
  }

  async cancel(cancelToken: string, email: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { cancelToken },
      include: {
        tables: { include: { table: { include: { zone: true } } } },
      },
    });

    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    if (reservation.customerEmail.toLowerCase() !== email.toLowerCase()) {
      throw new ForbiddenException('El email no coincide con la reserva');
    }
    if (reservation.status === 'CANCELLED') {
      throw new BadRequestException('La reserva ya está cancelada');
    }

    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    try {
      await this.emailService.sendCancellationConfirmation(reservation);
      await this.emailService.notifyStaffCancellation(reservation);
    } catch (error) {
      console.error('Error sending cancellation email:', error);
    }

    return { message: 'Reserva cancelada correctamente' };
  }

  async findByDate(date: string) {
    return this.prisma.reservation.findMany({
      where: {
        date: new Date(date),
        status: { not: 'CANCELLED' },
      },
      include: {
        tables: { include: { table: { include: { zone: true } } } },
      },
      orderBy: [{ hour: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateStatus(id: string, status: 'CONFIRMED' | 'REJECTED', staffNotes?: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    return this.prisma.reservation.update({
      where: { id },
      data: { status, staffNotes },
    });
  }
}
