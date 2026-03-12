import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================================
// ZONE & TABLE SEED DATA (matches the front-end floor plans)
// ============================================================
const ZONES_SEED = [
  {
    name: 'Zona Principal',
    slug: 'principal',
    description: 'Zona principal con barra, mesas y estantería de juegos',
    mapWidth: 720,
    mapHeight: 520,
    sortOrder: 0,
    furniture: [
      { type: 'bar', x: 10, y: 2, w: 200, h: 50, label: 'BARRA' },
      { type: 'shelf', x: 430, y: 2, w: 270, h: 45, label: 'ESTANTERÍA JUEGOS' },
      { type: 'door', x: 310, y: 475, w: 100, h: 40, label: 'ENTRADA' },
      { type: 'kitchen', x: 10, y: 470, w: 130, h: 40, label: 'COCINA' },
    ],
    tables: [
      { code: 'B1', label: 'Barra 1', seats: 3, posX: 50, posY: 85, width: 70, height: 55, shape: 'round', adjacentIds: ['B2'] },
      { code: 'B2', label: 'Barra 2', seats: 3, posX: 150, posY: 85, width: 70, height: 55, shape: 'round', adjacentIds: ['B1'] },
      { code: 'M1', label: 'Mesa 1', seats: 4, posX: 300, posY: 120, width: 80, height: 65, shape: 'rect', adjacentIds: ['M2', 'M4'] },
      { code: 'M2', label: 'Mesa 2', seats: 4, posX: 420, posY: 120, width: 80, height: 65, shape: 'rect', adjacentIds: ['M1', 'M3', 'M5'] },
      { code: 'M3', label: 'Mesa 3', seats: 4, posX: 540, posY: 120, width: 80, height: 65, shape: 'rect', adjacentIds: ['M2', 'M6'] },
      { code: 'M4', label: 'Mesa 4', seats: 4, posX: 300, posY: 250, width: 80, height: 65, shape: 'rect', adjacentIds: ['M1', 'M5', 'M7'] },
      { code: 'M5', label: 'Mesa 5', seats: 4, posX: 420, posY: 250, width: 80, height: 65, shape: 'rect', adjacentIds: ['M2', 'M4', 'M6', 'M8'] },
      { code: 'M6', label: 'Mesa 6', seats: 6, posX: 540, posY: 250, width: 90, height: 65, shape: 'rect', adjacentIds: ['M3', 'M5', 'M9'] },
      { code: 'M7', label: 'Mesa 7', seats: 4, posX: 300, posY: 380, width: 80, height: 65, shape: 'rect', adjacentIds: ['M4', 'M8'] },
      { code: 'M8', label: 'Mesa 8', seats: 4, posX: 420, posY: 380, width: 80, height: 65, shape: 'rect', adjacentIds: ['M5', 'M7', 'M9'] },
      { code: 'M9', label: 'Mesa 9', seats: 6, posX: 560, posY: 380, width: 90, height: 65, shape: 'rect', adjacentIds: ['M6', 'M8'] },
    ],
  },
  {
    name: 'Zona Sillones',
    slug: 'sillones',
    description: 'Zona de sillones cómodos para partidas largas',
    mapWidth: 400,
    mapHeight: 480,
    sortOrder: 1,
    furniture: [
      { type: 'shelf', x: 10, y: 2, w: 380, h: 40, label: 'ESTANTERÍA JUEGOS' },
    ],
    tables: [
      { code: 'S1', label: 'Sillón 1', seats: 6, posX: 20, posY: 340, width: 100, height: 70, shape: 'long', adjacentIds: ['S2'] },
      { code: 'S2', label: 'Sillón 2', seats: 6, posX: 150, posY: 340, width: 100, height: 70, shape: 'long', adjacentIds: ['S1', 'S7'] },
      { code: 'S3', label: 'Sillón 3', seats: 4, posX: 20, posY: 70, width: 90, height: 65, shape: 'rect', adjacentIds: ['S4', 'S5'] },
      { code: 'S4', label: 'Sillón 4', seats: 4, posX: 150, posY: 70, width: 90, height: 65, shape: 'rect', adjacentIds: ['S3'] },
      { code: 'S5', label: 'Sillón 5', seats: 4, posX: 20, posY: 160, width: 90, height: 65, shape: 'rect', adjacentIds: ['S3', 'S6'] },
      { code: 'S6', label: 'Sillón 6', seats: 4, posX: 20, posY: 250, width: 90, height: 65, shape: 'rect', adjacentIds: ['S5', 'S7'] },
      { code: 'S7', label: 'Sillón 7', seats: 4, posX: 150, posY: 250, width: 90, height: 65, shape: 'rect', adjacentIds: ['S6', 'S2'] },
    ],
  },
  {
    name: 'Terraza',
    slug: 'terraza',
    description: 'Terraza exterior con mesas al aire libre',
    mapWidth: 600,
    mapHeight: 300,
    sortOrder: 2,
    furniture: [
      { type: 'plant', x: 10, y: 10, w: 60, h: 40, label: '🌿' },
      { type: 'plant', x: 530, y: 10, w: 60, h: 40, label: '🌿' },
      { type: 'plant', x: 10, y: 240, w: 60, h: 40, label: '🌿' },
      { type: 'plant', x: 530, y: 240, w: 60, h: 40, label: '🌿' },
    ],
    tables: [
      { code: 'T10', label: 'Mesa 10', seats: 4, posX: 80, posY: 60, width: 90, height: 65, shape: 'rect', adjacentIds: ['T11'] },
      { code: 'T11', label: 'Mesa 11', seats: 4, posX: 200, posY: 60, width: 90, height: 65, shape: 'rect', adjacentIds: ['T10', 'T12'] },
      { code: 'T12', label: 'Mesa 12', seats: 4, posX: 320, posY: 60, width: 90, height: 65, shape: 'rect', adjacentIds: ['T11', 'T13'] },
      { code: 'T13', label: 'Mesa 13', seats: 4, posX: 440, posY: 60, width: 90, height: 65, shape: 'rect', adjacentIds: ['T12'] },
      { code: 'T14', label: 'Mesa 14', seats: 4, posX: 140, posY: 180, width: 90, height: 65, shape: 'rect', adjacentIds: ['T15'] },
      { code: 'T15', label: 'Mesa 15', seats: 4, posX: 320, posY: 180, width: 90, height: 65, shape: 'rect', adjacentIds: ['T14'] },
    ],
  },
];

// ============================================================
// TYPE / CATEGORY / MECHANIC NAME MAPPINGS
// ============================================================
const TYPE_NAMES: Record<number, string> = {
  1: 'Estrategia', 2: 'Abstracto', 3: 'Familiar', 4: 'Wargames',
  5: 'Party / Fiesta', 7: 'Temático', 8: 'Infantil', 9: 'Cooperativo', 10: 'Filler',
};

const CAT_NAMES: Record<number, string> = {
  1:'Aventura',2:'Exploración',3:'Deducción',6:'Rol',8:'Fantasía',9:'Antiguo',10:'De dados',
  11:'Terror',12:'Ciencia ficción',13:'De cartas',15:'De cartas',16:'Gestión de mano',
  17:'Económico',18:'Medieval',19:'Civilización',20:'Construcción',21:'Destreza',22:'Humor',
  23:'Territorial',24:'Civilización',25:'Puzle',26:'Cooperativo',27:'Legacy',28:'Exploración',
  29:'Misterio',31:'Fantasía',32:'Comercio',33:'Miniaturas',34:'Piratas',35:'Dados',
  36:'Deducción',37:'Ciencia ficción',39:'Animales',40:'Lucha',41:'Coleccionable',
  42:'Viajes',43:'Médico',44:'Medieval',45:'Construcción ciudades',46:'Espionaje',
  47:'Político',48:'Puzzles',49:'Mitología',50:'Trenes',51:'Náutico',52:'Carreras',
  53:'Zombis',54:'Palabras',55:'Trivia',56:'Memoria',57:'De fiesta',59:'Adivinanzas',
  60:'Guerra moderna',61:'Historia',62:'Familiar',63:'Abstracto',64:'Negociación',
  65:'Habilidad',66:'Educativo',67:'Musical',68:'Deportes',69:'Temático',70:'Industria',
  71:'Agricultura',72:'Cocina',73:'Renacimiento',74:'Vikingos',75:'Asia',76:'Egipto',
  77:'Gatuno',78:'Dragones',80:'Guerra fría',81:'2ª Guerra Mundial',82:'1ª Guerra Mundial',
  83:'Americano',84:'Zombis',
};

const MECH_NAMES: Record<number, string> = {
  1:'Tirada de dados',3:'Gestión de acciones',5:'Subastas',7:'Faroleo',8:'Apuestas',
  9:'Movimiento',10:'Campaña',11:'Reclutamiento',13:'Gestión de cartas',15:'Combos',
  16:'Comunicación',17:'Contratos',19:'Cooperativo',20:'Mayorías',21:'Coste de acciones',
  22:'Crucigramas',23:'Colocación de dados',24:'Construcción de mazos',25:'Borrador de cartas',
  26:'Eliminación',27:'Área de influencia',28:'Drafting',29:'Rapidez',30:'Destreza',
  31:'Escritura',32:'Apilamiento',33:'Colocación de losetas',35:'Emparejar',36:'Simultáneo',
  37:'Puntos final',38:'Equipos',39:'Roles ocultos',40:'Cooperativo',44:'Bloqueo',
  45:'Identidades ocultas',46:'Mapa modular',47:'Movimiento cuadrícula',48:'Gestión de mano',
  49:'Hexagonal',51:'Rondas',52:'Legado',53:'Intercambio',54:'Colocación obreros',
  55:'Selección de acciones',56:'Subasta',57:'Mapa',58:'Roles especiales',60:'Tirar y mover',
  61:'Colocación losetas',62:'Colección de conjuntos',63:'Puntos de victoria',64:'Storytelling',
  65:'Votación',66:'Producción',68:'Poder de veto',71:'Recursos variables',72:'Influencia',
  74:'Memoria',75:'Negociación',76:'Cartas de objetivo',77:'Toma de riesgos',78:'Descarte',
  79:'Capas',80:'Movimiento de peones',81:'Programación',82:'Construcción de rutas',
  83:'Patrones',84:'Carreras',85:'Preguntas',86:'Lectura labios',87:'Poderes asimétricos',
  88:'Adivinanzas',89:'Reconocimiento',91:'Agilidad',92:'Tiempo real',93:'Elección múltiple',
  95:'Tira y afloja',96:'Solitario',98:'Control zona',102:'Tokens',103:'Sigilo',104:'Tracks',
  105:'Puzle',106:'Trading',107:'Venta',108:'Mapas',110:'Mercado',111:'Escenarios',
  112:'Eventos',113:'Narrativo',114:'Misiones',115:'Supervivencia',116:'Tech tree',
  117:'Tablero personal',118:'Turno variable',119:'Fichas',120:'Bolsa',121:'Bonificaciones',
  122:'Puntuación por áreas',123:'Modificadores',124:'Multiplicadores',126:'Movimiento secreto',
  127:'Piedra-papel-tijeras',128:'Asimetría',129:'Apuestas ciegas',130:'Persuasión',
  131:'Multiusos',132:'Pactos',133:'Fase variable',134:'Crecimiento',135:'Combinación',
  136:'Alianzas',137:'Objetivos ocultos',138:'Exploración',139:'Revelación',
  140:'Fin de partida variable',141:'Cartas de evento',142:'Orden de turno variable',
  143:'Prueba de habilidad',144:'Acumulación',145:'Intercambio forzado',146:'Income',
  147:'Tablero oculto',148:'Derrota cooperativa',149:'Bloqueo de acciones',
  150:'Límite de mano',151:'Entrega',152:'Reserva de acciones',153:'Selección simultánea',
  154:'Final de muerte súbita',155:'Paso de cartas',156:'Cadena de acciones',
  157:'Movimiento en área',158:'Poder especial',159:'Resolución de combate',
  160:'Mercado abierto',161:'Apuesta progresiva',162:'Resultado aleatorio',
  163:'Cartas multifunción',164:'Pago de recursos',165:'Traición',166:'Tira y afloja',
  168:'Protección',169:'Ingresos',170:'Rondas fijas',172:'Coste variable',
  173:'Red de conexiones',174:'Acciones limitadas',175:'Turnos',176:'Conexiones',
  177:'Habilidad especial',178:'Expansión territorial',179:'Mazo compartido',
  180:'Despliegue',181:'Preparación',
};

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
async function main() {
  console.log('🌱 Seeding El Búnker database...\n');

  // ------ 1. SEED ZONES & TABLES ------
  console.log('📍 Creating zones and tables...');
  for (const zoneData of ZONES_SEED) {
    const { tables, ...zoneFields } = zoneData;

    const zone = await prisma.zone.upsert({
      where: { slug: zoneFields.slug },
      update: { ...zoneFields, furniture: zoneFields.furniture as any },
      create: { ...zoneFields, furniture: zoneFields.furniture as any },
    });

    for (const tableData of tables) {
      await prisma.table.upsert({
        where: { zoneId_code: { zoneId: zone.id, code: tableData.code } },
        update: { ...tableData, zoneId: zone.id },
        create: { ...tableData, zoneId: zone.id },
      });
    }

    console.log(`  ✅ ${zone.name}: ${tables.length} mesas`);
  }

  // ------ 2. SEED TYPES, CATEGORIES, MECHANICS ------
  console.log('\n🏷️  Creating types, categories, mechanics...');

  for (const [id, name] of Object.entries(TYPE_NAMES)) {
    await prisma.type.upsert({ where: { id: +id }, update: { name }, create: { id: +id, name } });
  }
  console.log(`  ✅ ${Object.keys(TYPE_NAMES).length} types`);

  for (const [id, name] of Object.entries(CAT_NAMES)) {
    await prisma.category.upsert({ where: { id: +id }, update: { name }, create: { id: +id, name } });
  }
  console.log(`  ✅ ${Object.keys(CAT_NAMES).length} categories`);

  for (const [id, name] of Object.entries(MECH_NAMES)) {
    await prisma.mechanic.upsert({ where: { id: +id }, update: { name }, create: { id: +id, name } });
  }
  console.log(`  ✅ ${Object.keys(MECH_NAMES).length} mechanics`);

  // ------ 3. SEED GAMES FROM JSON ------
  // NOTE: Place your juegos.json in the prisma/ folder
  // Uncomment this section when you have the file:
  /*
  console.log('\n🎲 Importing games from juegos.json...');
  const fs = require('fs');
  const gamesData = JSON.parse(fs.readFileSync('./prisma/juegos.json', 'utf-8'));

  let count = 0;
  for (const g of gamesData.games) {
    const players = g.players.split(',').map(Number);
    const best = g.players_best?.split(',').map(Number) || [0, 0];
    const duration = g.duration.split(',').map(Number);
    const age = g.age.split(',').map(Number);
    const typeIds = g.type_ids ? g.type_ids.split(',').map(Number).filter(Boolean) : [];
    const catIds = g.category_ids ? g.category_ids.split(',').map(Number).filter(Boolean) : [];
    const mechIds = g.mechanic_ids ? g.mechanic_ids.split(',').map(Number).filter(Boolean) : [];

    const game = await prisma.game.upsert({
      where: { externalId: +g.id },
      update: { name: g.name },
      create: {
        externalId: +g.id,
        name: g.name,
        playersMin: players[0],
        playersMax: players[1],
        playersBest: best[0],
        durationMin: duration[0],
        durationMax: duration[1],
        ageMin: age[0],
        difficulty: +g.difficulty || 0,
      },
    });

    // Create relations (skip if already exist)
    for (const tid of typeIds) {
      if (TYPE_NAMES[tid]) {
        await prisma.gameType.upsert({
          where: { gameId_typeId: { gameId: game.id, typeId: tid } },
          update: {},
          create: { gameId: game.id, typeId: tid },
        });
      }
    }
    for (const cid of catIds) {
      if (CAT_NAMES[cid]) {
        await prisma.gameCategory.upsert({
          where: { gameId_categoryId: { gameId: game.id, categoryId: cid } },
          update: {},
          create: { gameId: game.id, categoryId: cid },
        });
      }
    }
    for (const mid of mechIds) {
      if (MECH_NAMES[mid]) {
        await prisma.gameMechanic.upsert({
          where: { gameId_mechanicId: { gameId: game.id, mechanicId: mid } },
          update: {},
          create: { gameId: game.id, mechanicId: mid },
        });
      }
    }

    count++;
    if (count % 50 === 0) console.log(`  ... ${count} games imported`);
  }
  console.log(`  ✅ ${count} games imported`);
  */

  // ------ 4. SEED ADMIN USER ------
  console.log('\n👤 Creating admin user...');
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@elbunker.es' },
    update: {},
    create: {
      email: 'admin@elbunker.es',
      passwordHash: adminPassword,
      name: 'Admin',
      role: 'ADMIN',
    },
  });
  console.log('  ✅ admin@elbunker.es / admin123');

  console.log('\n✨ Seed complete!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
