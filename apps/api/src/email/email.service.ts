import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.config.get('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  private async send(to: string, subject: string, html: string, reservationId?: string) {
    const from = this.config.get('EMAIL_FROM', 'El Búnker <hola@elbunker.es>');

    try {
      await this.transporter.sendMail({ from, to, subject, html });

      // Log email
      await this.prisma.emailLog.create({
        data: {
          type: subject.includes('Cancelación') ? 'cancellation' :
                subject.includes('Solicitud') ? 'special-request' :
                subject.includes('Nueva reserva') ? 'staff-notify' : 'confirmation',
          to,
          subject,
          status: 'sent',
          reservationId,
        },
      });
    } catch (error) {
      await this.prisma.emailLog.create({
        data: {
          type: 'error',
          to,
          subject,
          status: 'failed',
          error: error.message,
          reservationId,
        },
      });
      throw error;
    }
  }

  // ====================================================
  // EMAIL TEMPLATES
  // ====================================================

  async sendReservationConfirmation(reservation: any) {
    const tables = reservation.tables?.map((rt: any) => rt.table) || [];
    const tableCodes = tables.map((t: any) => t.code).join(' + ');
    const totalSeats = tables.reduce((s: number, t: any) => s + t.seats, 0);
    const zoneName = tables[0]?.zone?.name || '';
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');
    const cancelUrl = `${frontendUrl}/cancelar/${reservation.cancelToken}`;

    const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#FFF8E7;">
      <div style="background:#1A1A2E;padding:24px;text-align:center;">
        <h1 style="color:#FFD60A;margin:0;font-size:28px;">🎲 El Búnker</h1>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:14px;">Board Game Café</p>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="color:#1A1A2E;margin:0 0 8px;">¡Reserva confirmada!</h2>
        <p style="color:#4A4A60;font-size:16px;line-height:1.6;">
          Hola <strong>${reservation.customerName}</strong>, tu reserva está confirmada.
        </p>
        <div style="background:#fff;border-radius:12px;padding:20px;margin:20px 0;border:2px solid #FFD60A;">
          <table style="width:100%;border-collapse:collapse;font-size:15px;">
            <tr><td style="padding:8px 0;color:#7A7A90;width:120px;">Fecha</td><td style="padding:8px 0;color:#1A1A2E;font-weight:700;">${new Date(reservation.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
            <tr><td style="padding:8px 0;color:#7A7A90;">Hora</td><td style="padding:8px 0;color:#1A1A2E;font-weight:700;">${reservation.hour}</td></tr>
            <tr><td style="padding:8px 0;color:#7A7A90;">Zona</td><td style="padding:8px 0;color:#1A1A2E;font-weight:700;">${zoneName}</td></tr>
            <tr><td style="padding:8px 0;color:#7A7A90;">Mesa${tables.length > 1 ? 's' : ''}</td><td style="padding:8px 0;color:#1A1A2E;font-weight:700;">${tableCodes} (${totalSeats} plazas)</td></tr>
            <tr><td style="padding:8px 0;color:#7A7A90;">Personas</td><td style="padding:8px 0;color:#1A1A2E;font-weight:700;">${reservation.people}</td></tr>
            ${reservation.eventType ? `<tr><td style="padding:8px 0;color:#7A7A90;">Evento</td><td style="padding:8px 0;color:#1A1A2E;font-weight:700;">${reservation.eventType}</td></tr>` : ''}
          </table>
        </div>
        ${reservation.notes ? `<p style="color:#4A4A60;font-size:14px;background:#f5f0e0;padding:12px;border-radius:8px;">📝 ${reservation.notes}</p>` : ''}
        <div style="margin:24px 0;text-align:center;">
          <p style="color:#7A7A90;font-size:13px;">¿Necesitas cancelar? Haz clic aquí:</p>
          <a href="${cancelUrl}" style="color:#FF6B6B;font-size:13px;">Cancelar reserva</a>
        </div>
        <div style="border-top:1px solid #e0d8c0;padding-top:16px;margin-top:16px;">
          <p style="color:#7A7A90;font-size:13px;text-align:center;">
            📍 Calle Ejemplo, 42 · 28001 Madrid<br>
            📞 912 345 678 · ✉️ hola@elbunker.es
          </p>
        </div>
      </div>
    </div>`;

    await this.send(
      reservation.customerEmail,
      `Reserva confirmada — ${new Date(reservation.date).toLocaleDateString('es-ES')} a las ${reservation.hour}`,
      html,
      reservation.id,
    );
  }

  async notifyStaffNewReservation(reservation: any) {
    const staffEmail = this.config.get('STAFF_EMAIL', 'hola@elbunker.es');
    const tables = reservation.tables?.map((rt: any) => rt.table) || [];
    const tableCodes = tables.map((t: any) => t.code).join(' + ');
    const zoneName = tables[0]?.zone?.name || '';

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;">
      <h2 style="color:#1A1A2E;">🎲 Nueva reserva</h2>
      <table style="font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Cliente</td><td><strong>${reservation.customerName}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Email</td><td>${reservation.customerEmail}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Teléfono</td><td>${reservation.customerPhone}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Fecha</td><td><strong>${new Date(reservation.date).toLocaleDateString('es-ES')}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Hora</td><td><strong>${reservation.hour}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Zona</td><td>${zoneName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Mesa(s)</td><td>${tableCodes}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888;">Personas</td><td>${reservation.people}</td></tr>
        ${reservation.eventType ? `<tr><td style="padding:4px 12px 4px 0;color:#888;">Evento</td><td>${reservation.eventType}</td></tr>` : ''}
        ${reservation.notes ? `<tr><td style="padding:4px 12px 4px 0;color:#888;">Notas</td><td>${reservation.notes}</td></tr>` : ''}
      </table>
    </div>`;

    await this.send(staffEmail, `Nueva reserva: ${reservation.customerName} — ${reservation.hour}`, html, reservation.id);
  }

  async notifyStaffSpecialRequest(reservation: any, zoneName: string) {
    const staffEmail = this.config.get('STAFF_EMAIL', 'hola@elbunker.es');

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;">
      <h2 style="color:#FF9800;">⚠️ Solicitud grupo grande</h2>
      <p style="background:#FFF3E0;padding:12px;border-radius:8px;border:1px solid #FFB74D;">
        <strong>${reservation.customerName}</strong> ha solicitado mesa para <strong>${reservation.people} personas</strong>
        en <strong>${zoneName}</strong> el <strong>${new Date(reservation.date).toLocaleDateString('es-ES')}</strong> a las <strong>${reservation.hour}</strong>.
      </p>
      <p><strong>Contacto:</strong> ${reservation.customerEmail} · ${reservation.customerPhone}</p>
      ${reservation.eventType ? `<p><strong>Tipo:</strong> ${reservation.eventType}</p>` : ''}
      <p><strong>Notas:</strong> ${reservation.notes || '—'}</p>
      <p style="color:#888;font-size:13px;">Esta solicitud está PENDIENTE. Confirma o rechaza desde el panel de admin.</p>
    </div>`;

    await this.send(staffEmail, `⚠️ Solicitud grupo grande: ${reservation.people} personas`, html, reservation.id);
  }

  async sendCancellationConfirmation(reservation: any) {
    const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#FFF8E7;">
      <div style="background:#1A1A2E;padding:24px;text-align:center;">
        <h1 style="color:#FFD60A;margin:0;font-size:28px;">🎲 El Búnker</h1>
      </div>
      <div style="padding:32px 24px;text-align:center;">
        <h2 style="color:#1A1A2E;">Reserva cancelada</h2>
        <p style="color:#4A4A60;">Hola ${reservation.customerName}, tu reserva del ${new Date(reservation.date).toLocaleDateString('es-ES')} a las ${reservation.hour} ha sido cancelada.</p>
        <p style="color:#7A7A90;font-size:14px;">Esperamos verte pronto. ¡Puedes hacer una nueva reserva cuando quieras!</p>
      </div>
    </div>`;

    await this.send(reservation.customerEmail, 'Cancelación confirmada — El Búnker', html, reservation.id);
  }

  async notifyStaffCancellation(reservation: any) {
    const staffEmail = this.config.get('STAFF_EMAIL', 'hola@elbunker.es');
    const html = `<p>❌ <strong>${reservation.customerName}</strong> ha cancelado su reserva del ${new Date(reservation.date).toLocaleDateString('es-ES')} a las ${reservation.hour}.</p>`;
    await this.send(staffEmail, `Cancelación: ${reservation.customerName}`, html, reservation.id);
  }
}
