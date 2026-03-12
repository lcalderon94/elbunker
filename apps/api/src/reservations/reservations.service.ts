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

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Create a reservation with server-side validation.
   * Uses a transaction to prevent race conditions.
   */
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

    // 3. Execute in transaction (prevents two people reserving same table)
    const reservation = await this.prisma.$transaction(async (tx) => {
      // Find zone
      const zone = await tx.zone.findUnique({
        where: { slug: dto.zoneSlug },
        include: { tables: true },
      });
      if (!zone) throw new NotFoundException(`Zona '${dto.zoneSlug}' no encontrada`);

      // Find requested tables
      const tables = zone.tables.filter((t) => dto.tableCodes.includes(t.code));
      if (tables.length !== dto.tableCodes.length) {
        const found = tables.map((t) => t.code);
        const missing = dto.tableCodes.filter((c) => !found.includes(c));
        throw new BadRequestException(`Mesas no encontradas: ${missing.join(', ')}`);
      }

      // Validate adjacency if combining tables
      if (tables.length > 1) {
        for (let i = 1; i < tables.length; i++) {
          const isAdjToAny = tables.slice(0, i).some((prev) =>
            tables[i].adjacentIds.includes(prev.code),
          );
          if (!isAdjToAny) {
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

      // Check availability — lock rows to prevent race condition
      const tableIds = tables.map((t) => t.id);
      const conflicts = await tx.reservationTable.findMany({
        where: {
          tableId: { in: tableIds },
          reservation: {
            date: reservationDate,
            hour: dto.hour,
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
        },
        include: { table: true },
      });

      if (conflicts.length > 0) {
        const conflictCodes = [...new Set(conflicts.map((c) => c.table.code))];
        throw new ConflictException(
          `Las siguientes mesas ya están reservadas: ${conflictCodes.join(', ')}`,
        );
      }

      // Create reservation
      const cancelToken = randomBytes(32).toString('hex');
      const newReservation = await tx.reservation.create({
        data: {
          date: reservationDate,
          hour: dto.hour,
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

    // 4. Send emails (outside transaction — don't fail reservation if email fails)
    try {
      await this.emailService.sendReservationConfirmation(reservation);
      await this.emailService.notifyStaffNewReservation(reservation);
    } catch (error) {
      console.error('Error sending email:', error);
      // Log but don't fail the reservation
    }

    return {
      id: reservation.id,
      date: reservation.date,
      hour: reservation.hour,
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
      message: '¡Reserva confirmada! Te hemos enviado un email de confirmación.',
    };
  }

  /**
   * Create a special request for large groups.
   * Status = PENDING, staff must confirm.
   */
  async createSpecialRequest(dto: SpecialRequestDto) {
    // Validate
    if (!VALID_HOURS.includes(dto.hour)) {
      throw new BadRequestException(`Hora '${dto.hour}' no es válida`);
    }

    const zone = await this.prisma.zone.findUnique({ where: { slug: dto.zoneSlug } });
    if (!zone) throw new NotFoundException(`Zona '${dto.zoneSlug}' no encontrada`);

    const cancelToken = randomBytes(32).toString('hex');
    const reservation = await this.prisma.reservation.create({
      data: {
        date: new Date(dto.date),
        hour: dto.hour,
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

    // Notify staff
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

  /**
   * Get reservation by ID (public — requires email match)
   */
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

  /**
   * Cancel a reservation using the cancel token
   */
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

    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    try {
      await this.emailService.sendCancellationConfirmation(reservation);
      await this.emailService.notifyStaffCancellation(reservation);
    } catch (error) {
      console.error('Error sending cancellation email:', error);
    }

    return { message: 'Reserva cancelada correctamente' };
  }

  /**
   * Admin: List reservations for a date
   */
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

  /**
   * Admin: Update reservation status (for special requests)
   */
  async updateStatus(id: string, status: 'CONFIRMED' | 'REJECTED', staffNotes?: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reserva no encontrada');

    return this.prisma.reservation.update({
      where: { id },
      data: { status, staffNotes },
    });
  }
}
