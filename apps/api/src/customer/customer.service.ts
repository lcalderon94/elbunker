import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class CustomerService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ============================================================
  // REGISTER — cliente se registra manualmente
  // ============================================================
  async register(email: string, password: string, name: string, phone?: string) {
    const existing = await this.prisma.customer.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este email. ¿Quizás se creó al hacer una reserva? Intenta iniciar sesión.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const customer = await this.prisma.customer.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        phone,
        isAutoCreated: false,
      },
    });

    return this.generateToken(customer);
  }

  // ============================================================
  // LOGIN
  // ============================================================
  async login(email: string, password: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!customer) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    return this.generateToken(customer);
  }

  // ============================================================
  // AUTO-CREATE — se crea cuenta automática al reservar
  // Devuelve la contraseña temporal para enviarla por email
  // ============================================================
  async findOrCreateForReservation(email: string, name: string, phone: string) {
    const existing = await this.prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      // Ya tiene cuenta, actualizar datos si faltan
      if (!existing.phone && phone) {
        await this.prisma.customer.update({
          where: { id: existing.id },
          data: { phone },
        });
      }
      return { customer: existing, tempPassword: null, isNew: false };
    }

    // Crear cuenta con contraseña temporal
    const tempPassword = randomBytes(4).toString('hex'); // 8 chars, ej: "a1b2c3d4"
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const customer = await this.prisma.customer.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        phone,
        isAutoCreated: true,
      },
    });

    return { customer, tempPassword, isNew: true };
  }

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================
  async changePassword(customerId: string, currentPassword: string, newPassword: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new BadRequestException('Cliente no encontrado');

    const valid = await bcrypt.compare(currentPassword, customer.passwordHash);
    if (!valid) throw new UnauthorizedException('Contraseña actual incorrecta');

    if (newPassword.length < 6) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { passwordHash },
    });

    return { message: 'Contraseña actualizada' };
  }

  // ============================================================
  // GET PROFILE
  // ============================================================
  async getProfile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true, email: true, name: true, phone: true,
        isAutoCreated: true, createdAt: true,
      },
    });
    if (!customer) throw new BadRequestException('Cliente no encontrado');
    return customer;
  }

  // ============================================================
  // UPDATE PROFILE
  // ============================================================
  async updateProfile(customerId: string, data: { name?: string; phone?: string }) {
    return this.prisma.customer.update({
      where: { id: customerId },
      data,
      select: { id: true, email: true, name: true, phone: true },
    });
  }

  // ============================================================
  // MY RESERVATIONS — lista de reservas del cliente
  // ============================================================
  async getMyReservations(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) throw new BadRequestException('Cliente no encontrado');

    const reservations = await this.prisma.reservation.findMany({
      where: {
        OR: [
          { customerId },
          { customerEmail: customer.email },
        ],
      },
      include: {
        tables: {
          include: { table: { include: { zone: true } } },
        },
      },
      orderBy: [{ date: 'desc' }, { hour: 'desc' }],
    });

    return reservations.map((r) => ({
      id: r.id,
      date: r.date,
      hour: r.hour,
      people: r.people,
      status: r.status,
      eventType: r.eventType,
      notes: r.notes,
      isCombined: r.isCombined,
      isSpecialRequest: r.isSpecialRequest,
      cancelToken: r.cancelToken,
      createdAt: r.createdAt,
      tables: r.tables.map((rt) => ({
        code: rt.table.code,
        label: rt.table.label,
        seats: rt.table.seats,
        zone: rt.table.zone.name,
        zoneSlug: rt.table.zone.slug,
      })),
      // Para "repetir reserva"
      rebookData: {
        zoneSlug: r.tables[0]?.table.zone.slug,
        people: r.people,
        eventType: r.eventType,
      },
    }));
  }

  // ============================================================
  // VALIDATE TOKEN — extraer customer de JWT
  // ============================================================
  async validateToken(token: string) {
    try {
      const payload = this.jwt.verify(token);
      if (payload.type !== 'customer') return null;
      return this.prisma.customer.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true, phone: true },
      });
    } catch {
      return null;
    }
  }

  // ============================================================
  private generateToken(customer: any) {
    const payload = { sub: customer.id, email: customer.email, type: 'customer' };
    return {
      token: this.jwt.sign(payload),
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
      },
    };
  }
}
