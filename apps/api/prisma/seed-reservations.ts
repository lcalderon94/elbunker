import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Helpers
const token = () => randomBytes(16).toString('hex');
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const NOMBRES = [
  'García', 'López', 'Martínez', 'Sánchez', 'Rodríguez', 'Fernández',
  'González', 'Pérez', 'Díaz', 'Moreno', 'Jiménez', 'Ruiz', 'Hernández',
  'Torres', 'Ramírez', 'Flores', 'Álvarez', 'Navarro', 'Castro', 'Romero',
  'Vega', 'Blanco', 'Medina', 'Reyes', 'Guerrero', 'Molina', 'Delgado',
];

const EMAILS = (name: string) => `${name.toLowerCase().replace(/[áéíóúñ]/g, c =>
  ({á:'a',é:'e',í:'i',ó:'o',ú:'u',ñ:'n'}[c]||c))}${Math.floor(Math.random()*99)}@gmail.com`;

const PHONES = () => `6${Math.floor(Math.random()*9)}${String(Math.floor(Math.random()*9999999)).padStart(7,'0')}`;

const TIPOS_EVENTO = [null, null, null, 'Cumpleaños', 'Afterwork', 'Evento privado', null, null];

// Hours available per day type
const WEEKDAY_HOURS = ['17:00','18:00','19:00','20:00','21:00','22:00'];
const WEEKEND_HOURS = ['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];

function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 5 || dow === 6; // Sun, Fri, Sat
}

function getHours(date: Date): string[] {
  return isWeekend(date) ? WEEKEND_HOURS : WEEKDAY_HOURS;
}

// How busy each day should be (0=empty, 1=full)
function getBusyness(date: Date): number {
  const dow = date.getDay();
  const dayNum = date.getDate();
  
  // Weekends very busy
  if (dow === 6) return 0.85; // Saturday
  if (dow === 5) return 0.75; // Friday
  if (dow === 0) return 0.65; // Sunday
  
  // Some special days
  if (dayNum === 19 && date.getMonth() === 2) return 0.3;  // today (March 19)
  if (dayNum === 22 && date.getMonth() === 2) return 0.7;  // weekend
  if (dayNum === 1  && date.getMonth() === 3) return 0.9;  // April 1 (busy)
  if (dayNum === 18 && date.getMonth() === 3) return 0.95; // April 18 (muy lleno - festivo)
  if (dayNum === 19 && date.getMonth() === 3) return 0.95; // April 19 Semana Santa
  if (dayNum === 20 && date.getMonth() === 3) return 0.9;  // April 20 Semana Santa
  if (dayNum === 21 && date.getMonth() === 3) return 0.85; // April 21 Semana Santa
  
  // Weekdays moderate
  if (dow === 1) return 0.2; // Monday
  if (dow === 2) return 0.35; // Tuesday
  if (dow === 3) return 0.40; // Wednesday
  if (dow === 4) return 0.55; // Thursday
  
  return 0.3;
}

async function main() {
  console.log('🎲 Generando reservas mockeadas (19 Mar - 1 May 2026)...\n');

  // Get zones and tables from DB
  const zones = await prisma.zone.findMany({
    include: { tables: { where: { isActive: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  if (zones.length === 0) {
    console.error('❌ No hay zonas en la BD. Ejecuta el seed principal primero.');
    process.exit(1);
  }

  console.log(`✅ Zonas encontradas: ${zones.map(z => z.name).join(', ')}\n`);

  // Delete existing reservations in the date range
  const startDate = new Date('2026-03-19T00:00:00');
  const endDate = new Date('2026-05-01T23:59:59');
  
  const deleted = await prisma.reservation.deleteMany({
    where: { date: { gte: startDate, lte: endDate } }
  });
  if (deleted.count > 0) console.log(`🗑️  Eliminadas ${deleted.count} reservas previas en el rango\n`);

  let totalCreated = 0;

  // Loop through each day
  const current = new Date('2026-03-19T12:00:00');
  const end = new Date('2026-05-01T12:00:00');

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const busyness = getBusyness(current);
    const hours = getHours(current);
    const dayName = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][current.getDay()];
    
    let dayCount = 0;

    for (const hour of hours) {
      // Skip this hour randomly based on busyness
      if (Math.random() > busyness) continue;

      // For each zone, decide if there are reservations
      for (const zone of zones) {
        const tables = zone.tables;
        if (tables.length === 0) continue;

        // How many tables to occupy in this zone/hour
        const maxOccupy = Math.floor(tables.length * busyness * (0.5 + Math.random() * 0.8));
        if (maxOccupy === 0) continue;

        // Shuffle tables and pick some
        const shuffled = [...tables].sort(() => Math.random() - 0.5);
        const toOccupy = shuffled.slice(0, Math.min(maxOccupy, shuffled.length));

        for (const table of toOccupy) {
          const nombre = pick(NOMBRES);
          const duration = Math.random() > 0.3 ? 2 : (Math.random() > 0.5 ? 3 : 1);
          const people = Math.min(table.seats, Math.max(1, Math.floor(table.seats * (0.5 + Math.random() * 0.6))));
          const eventType = Math.random() > 0.85 ? pick(TIPOS_EVENTO.filter(Boolean) as string[]) : null;

          try {
            await prisma.reservation.create({
              data: {
                date: new Date(dateStr + 'T12:00:00'),
                hour,
                duration,
                people,
                status: 'CONFIRMED',
                customerName: nombre,
                customerEmail: EMAILS(nombre),
                customerPhone: PHONES(),
                eventType,
                cancelToken: token(),
                tables: {
                  create: [{ tableId: table.id }],
                },
              },
            });
            dayCount++;
            totalCreated++;
          } catch {
            // Skip conflicts silently (same table double-booked)
          }
        }
      }
    }

    if (dayCount > 0) {
      console.log(`  📅 ${dayName} ${dateStr}: ${dayCount} reservas (ocupación ~${Math.round(busyness*100)}%)`);
    }

    current.setDate(current.getDate() + 1);
  }

  console.log(`\n✅ Total: ${totalCreated} reservas creadas`);
  console.log('🎲 ¡Dexter ya puede consultar disponibilidad real!\n');

  // Show summary
  const resCount = await prisma.reservation.count();
  console.log(`📊 Total reservas en BD: ${resCount}`);
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
