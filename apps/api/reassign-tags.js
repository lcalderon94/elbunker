#!/usr/bin/env node
/**
 * ============================================================
 * reassign-tags.js — Reasigna categorías, mecánicas y tipos
 * ============================================================
 * 
 * Usa la API de Anthropic para asignar correctamente los IDs de
 * categoría, mecánica y tipo a cada juego, basándose en:
 *   - El nombre del juego
 *   - Su descripción y jugabilidad (generadas en fase 1)
 *   - Sus datos (jugadores, duración, dificultad)
 * 
 * USO:
 *   set ANTHROPIC_API_KEY=sk-ant-xxx
 *   node reassign-tags.js
 * 
 * OPCIONES:
 *   --batch-size=5    Juegos por llamada (default: 5)
 *   --delay=1500      Delay entre llamadas en ms (default: 1500)
 *   --input=FILE      Archivo de entrada (default: games_enriched.json)
 *   --output=FILE     Archivo de salida (default: games_retagged.json)
 *   --dry-run         No llama a la API
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIG
// ============================================================

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v ?? true;
  return acc;
}, {});

const CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: 'claude-sonnet-4-20250514',
  batchSize: parseInt(args['batch-size']) || 5,
  delayMs: parseInt(args['delay']) || 1500,
  inputFile: args['input'] || 'games_enriched.json',
  outputFile: args['output'] || 'games_retagged.json',
  dryRun: !!args['dry-run'],
  maxRetries: 3,
};

// ============================================================
// COMPLETE DATABASE TABLES (from screenshots)
// ============================================================

const TYPES = {
  1:'Estrategia', 2:'Abstracto', 3:'Familiar', 4:'Wargames',
  5:'Party / Fiesta', 7:'Temático', 8:'Infantil', 9:'Cooperativo', 10:'Filler'
};

const CATEGORIES = {
  1:'Aventura', 2:'Exploración', 3:'Deducción', 6:'Rol', 8:'Fantasía', 9:'Antiguo',
  10:'De dados', 11:'Terror', 12:'Ciencia ficción', 13:'De cartas', 15:'De cartas',
  16:'Gestión de mano', 17:'Económico', 18:'Medieval', 19:'Civilización',
  20:'Construcción', 21:'Destreza', 22:'Humor', 23:'Territorial', 24:'Civilización',
  25:'Puzle', 26:'Cooperativo', 27:'Legacy', 28:'Exploración', 29:'Misterio',
  31:'Fantasía', 32:'Comercio', 33:'Miniaturas', 34:'Piratas', 35:'Dados',
  36:'Deducción', 37:'Ciencia ficción', 39:'Animales', 40:'Lucha', 41:'Coleccionable',
  42:'Viajes', 43:'Médico', 44:'Medieval', 45:'Construcción ciudades', 46:'Espionaje',
  47:'Político', 48:'Puzzles', 49:'Mitología', 50:'Trenes', 51:'Náutico',
  52:'Carreras', 53:'Zombis', 54:'Palabras', 55:'Trivia', 56:'Memoria',
  57:'De fiesta', 59:'Adivinanzas', 60:'Guerra moderna', 61:'Historia',
  62:'Familiar', 63:'Abstracto', 64:'Negociación', 65:'Habilidad', 66:'Educativo',
  67:'Musical', 68:'Deportes', 69:'Temático', 70:'Industria', 71:'Agricultura',
  72:'Cocina', 73:'Renacimiento', 74:'Vikingos', 75:'Asia', 76:'Egipto',
  77:'Gatuno', 78:'Dragones', 80:'Guerra fría', 81:'2a Guerra Mundial',
  82:'1a Guerra Mundial', 83:'Americano', 84:'Zombis'
};

const MECHANICS = {
  1:'Tirada de dados', 3:'Gestión de acciones', 5:'Subastas', 7:'Faroleo',
  8:'Apuestas', 9:'Movimiento', 10:'Campaña', 11:'Reclutamiento',
  13:'Gestión de cartas', 15:'Combos', 16:'Comunicación', 17:'Contratos',
  19:'Cooperativo', 20:'Mayorías', 21:'Coste de acciones', 22:'Crucigramas',
  23:'Colocación de dados', 24:'Construcción de mazos', 25:'Borrador de cartas',
  26:'Eliminación', 27:'Área de influencia', 28:'Drafting', 29:'Rapidez',
  30:'Destreza', 31:'Escritura', 32:'Apilamiento', 33:'Colocación de losetas',
  35:'Emparejar', 36:'Simultáneo', 37:'Puntos final', 38:'Equipos',
  39:'Roles ocultos', 40:'Cooperativo', 44:'Bloqueo', 45:'Identidades ocultas',
  46:'Mapa modular', 47:'Movimiento cuadrícula', 48:'Gestión de mano',
  49:'Hexagonal', 51:'Rondas', 52:'Legado', 53:'Intercambio',
  54:'Colocación obreros', 55:'Selección de acciones', 56:'Subasta', 57:'Mapa',
  58:'Roles especiales', 60:'Tirar y mover', 61:'Colocación losetas',
  62:'Colección de conjuntos', 63:'Puntos de victoria', 64:'Storytelling',
  65:'Votación', 66:'Producción', 68:'Poder de veto', 71:'Recursos variables',
  72:'Influencia', 74:'Memoria', 75:'Negociación', 76:'Cartas de objetivo',
  77:'Toma de riesgos', 78:'Descarte', 79:'Capas', 80:'Movimiento de peones',
  81:'Programación', 82:'Construcción de rutas', 83:'Patrones', 84:'Carreras',
  85:'Preguntas', 86:'Lectura labios', 87:'Poderes asimétricos',
  88:'Adivinanzas', 89:'Reconocimiento', 91:'Agilidad', 92:'Tiempo real',
  93:'Elección múltiple', 95:'Tira y afloja', 96:'Solitario', 98:'Control zona',
  102:'Tokens', 103:'Sigilo', 104:'Tracks', 105:'Puzle', 106:'Trading',
  107:'Venta', 108:'Mapas', 110:'Mercado', 111:'Escenarios', 112:'Eventos',
  113:'Narrativo', 114:'Misiones', 115:'Supervivencia', 116:'Tech tree',
  117:'Tablero personal', 118:'Turno variable', 119:'Fichas', 120:'Bolsa',
  121:'Bonificaciones', 122:'Puntuación por áreas', 123:'Modificadores',
  124:'Multiplicadores', 126:'Movimiento secreto', 127:'Piedra-papel-tijeras',
  128:'Asimetría', 129:'Apuestas ciegas', 130:'Persuasión', 131:'Multiusos',
  132:'Pactos', 133:'Fase variable', 134:'Crecimiento', 135:'Combinación',
  136:'Alianzas', 137:'Objetivos ocultos', 138:'Exploración', 139:'Revelación',
  140:'Fin de partida variable', 141:'Cartas de evento',
  142:'Orden de turno variable', 143:'Prueba de habilidad', 144:'Acumulación',
  145:'Intercambio forzado', 146:'Income', 147:'Tablero oculto',
  148:'Derrota cooperativa', 149:'Bloqueo de acciones', 150:'Límite de mano',
  151:'Entrega', 152:'Reserva de acciones', 153:'Selección simultánea',
  154:'Final de muerte súbita', 155:'Paso de cartas', 156:'Cadena de acciones',
  157:'Movimiento en área', 158:'Poder especial', 159:'Resolución de combate',
  160:'Mercado abierto', 161:'Apuesta progresiva', 162:'Resultado aleatorio',
  163:'Cartas multifunción', 164:'Pago de recursos', 165:'Traición',
  166:'Tira y afloja', 168:'Protección', 169:'Ingresos', 170:'Rondas fijas',
  172:'Coste variable', 173:'Red de conexiones', 174:'Acciones limitadas',
  175:'Turnos', 176:'Conexiones', 177:'Habilidad especial',
  178:'Expansión territorial', 179:'Mazo compartido', 180:'Despliegue',
  181:'Preparación'
};

// ============================================================
// ANTHROPIC API
// ============================================================

async function callAnthropic(prompt, systemPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONFIG.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CONFIG.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

function buildSystemPrompt() {
  const typeList = Object.entries(TYPES)
    .map(([id, name]) => `  ${id}: ${name}`)
    .join('\n');

  const catList = Object.entries(CATEGORIES)
    .sort((a, b) => +a[0] - +b[0])
    .map(([id, name]) => `  ${id}: ${name}`)
    .join('\n');

  const mechList = Object.entries(MECHANICS)
    .sort((a, b) => +a[0] - +b[0])
    .map(([id, name]) => `  ${id}: ${name}`)
    .join('\n');

  return `Eres un experto en juegos de mesa con conocimiento enciclopédico.
Tu trabajo es asignar las ETIQUETAS CORRECTAS (tipos, categorías y mecánicas) a juegos de mesa.

Aquí están las tablas EXACTAS de la base de datos. SOLO puedes usar estos IDs:

═══ TIPOS (asigna 1-3 tipos por juego) ═══
${typeList}

═══ CATEGORÍAS (asigna 2-6 categorías por juego) ═══
${catList}

NOTA sobre categorías duplicadas:
- IDs 13 y 15 son ambos "De cartas" — usa el 13
- IDs 8 y 31 son ambos "Fantasía" — usa el 8
- IDs 3 y 36 son ambos "Deducción" — usa el 3
- IDs 12 y 37 son ambos "Ciencia ficción" — usa el 12
- IDs 2 y 28 son ambos "Exploración" — usa el 2
- IDs 19 y 24 son ambos "Civilización" — usa el 19
- IDs 18 y 44 son ambos "Medieval" — usa el 18
- IDs 53 y 84 son ambos "Zombis" — usa el 53
- IDs 25 y 48 son ambos "Puzle/Puzzles" — usa el 25

═══ MECÁNICAS (asigna 3-10 mecánicas por juego) ═══
${mechList}

NOTA sobre mecánicas duplicadas:
- IDs 19 y 40 son ambos "Cooperativo" — usa el 40
- IDs 33 y 61 son ambos "Colocación de losetas" — usa el 61
- IDs 5 y 56 son ambos "Subastas/Subasta" — usa el 5

REGLAS IMPORTANTES:
1. Usa SOLO IDs que existan en las tablas de arriba
2. NO inventes IDs nuevos
3. Basa tus asignaciones en tu conocimiento REAL del juego + la descripción/jugabilidad proporcionada
4. Para TIPOS: asigna el tipo principal primero. Máximo 3.
5. Para CATEGORÍAS: asigna las más relevantes. Entre 2 y 6.
6. Para MECÁNICAS: asigna las que el juego realmente use. Entre 3 y 10.
7. Para expansiones (datos vacíos): asigna las mismas etiquetas que el juego base
8. Sé PRECISO. No pongas "Terror" a un juego que no es de terror. No pongas "Cooperativo" a un juego competitivo.
9. Responde SOLO con JSON válido, sin texto antes ni después, sin backticks markdown`;
}

// ============================================================
// BATCH PROMPT
// ============================================================

function buildBatchPrompt(games) {
  const gamesInfo = games.map((g, i) => {
    const players = g.players || '0,0';
    const duration = g.duration || '0,0';
    const [pMin, pMax] = players.split(',').map(Number);
    const [dMin, dMax] = duration.split(',').map(Number);

    return `JUEGO ${i + 1}:
  ID: ${g.id}
  Nombre: ${g.name}
  Jugadores: ${pMin}-${pMax} | Duración: ${dMin}-${dMax}min | Dificultad: ${g.difficulty || 0}/5
  Descripción: ${g.description || '(sin descripción)'}
  Jugabilidad: ${g.gameplay || '(sin jugabilidad)'}`;
  }).join('\n\n');

  return `Asigna type_ids, category_ids y mechanic_ids CORRECTOS para estos ${games.length} juegos.

${gamesInfo}

Responde SOLO con un JSON array así (sin backticks ni markdown):
[
  {
    "id": "1",
    "name": "Nombre",
    "type_ids": "1,9",
    "category_ids": "13,26,43",
    "mechanic_ids": "3,40,62,148,175"
  }
]`;
}

// ============================================================
// PARSE RESPONSE
// ============================================================

function parseResponse(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.games && Array.isArray(parsed.games)) return parsed.games;
    return [parsed];
  } catch (e) {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { /* fall through */ }
    }
    console.error('  ⚠️  Could not parse JSON');
    console.error('  First 200 chars:', cleaned.substring(0, 200));
    return null;
  }
}

// Validate IDs against our tables
function validateIds(result) {
  const validTypeIds = new Set(Object.keys(TYPES).map(Number));
  const validCatIds = new Set(Object.keys(CATEGORIES).map(Number));
  const validMechIds = new Set(Object.keys(MECHANICS).map(Number));

  const typeIds = (result.type_ids || '').split(',').map(Number).filter(n => n && validTypeIds.has(n));
  const catIds = (result.category_ids || '').split(',').map(Number).filter(n => n && validCatIds.has(n));
  const mechIds = (result.mechanic_ids || '').split(',').map(Number).filter(n => n && validMechIds.has(n));

  return {
    type_ids: typeIds.join(','),
    category_ids: catIds.join(','),
    mechanic_ids: mechIds.join(','),
  };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('🏷️  ════════════════════════════════════════════════');
  console.log('   REASSIGN TAGS — Categorías, Mecánicas y Tipos');
  console.log('   ════════════════════════════════════════════════\n');

  if (!CONFIG.apiKey && !CONFIG.dryRun) {
    console.error('❌ Falta ANTHROPIC_API_KEY');
    console.error('   set ANTHROPIC_API_KEY=sk-ant-xxx');
    process.exit(1);
  }

  // Find input file
  const possiblePaths = [
    CONFIG.inputFile,
    path.join(__dirname, CONFIG.inputFile),
    path.join(__dirname, 'prisma', CONFIG.inputFile),
  ];
  let inputPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) { inputPath = p; break; }
  }
  if (!inputPath) {
    console.error('❌ No se encuentra ' + CONFIG.inputFile);
    process.exit(1);
  }

  const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const allGames = inputData.games || inputData;
  console.log('📂 Cargados ' + allGames.length + ' juegos de ' + inputPath);

  // Load existing progress
  let retagged = {};
  const outputPath = path.join(path.dirname(inputPath), CONFIG.outputFile);
  if (fs.existsSync(outputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      const arr = existing.games || existing;
      if (Array.isArray(arr)) {
        for (const g of arr) {
          if (g.id && g.type_ids_new) retagged[String(g.id)] = g;
        }
      }
      console.log('♻️  Ya procesados: ' + Object.keys(retagged).length);
    } catch (e) { /* ignore */ }
  }

  const pending = allGames.filter(g => !retagged[String(g.id)]);
  console.log('📋 Pendientes: ' + pending.length);

  if (pending.length === 0) {
    console.log('\n✅ ¡Todos los juegos ya están procesados!');
    return;
  }

  const totalBatches = Math.ceil(pending.length / CONFIG.batchSize);
  const systemPrompt = buildSystemPrompt();

  console.log('\n⚙️  Batch size: ' + CONFIG.batchSize + ' | Batches: ' + totalBatches);
  if (CONFIG.dryRun) console.log('🔵 DRY RUN');
  console.log('');

  let processed = 0, errors = 0;

  for (let i = 0; i < pending.length; i += CONFIG.batchSize) {
    const batch = pending.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
    const names = batch.map(g => g.name).join(', ').substring(0, 80);

    process.stdout.write('[' + batchNum + '/' + totalBatches + '] ' + names + '... ');

    if (CONFIG.dryRun) { console.log('(dry run)'); processed += batch.length; continue; }

    let result = null;
    for (let retry = 0; retry < CONFIG.maxRetries; retry++) {
      try {
        const prompt = buildBatchPrompt(batch);
        const response = await callAnthropic(prompt, systemPrompt);
        result = parseResponse(response);
        if (result && result.length > 0) break;
        console.log('\n  ⚠️  Respuesta vacía, reintento ' + (retry + 1));
      } catch (err) {
        if (err.message.includes('429')) {
          console.log('\n  ⏳ Rate limit, esperando 30s...');
          await sleep(30000);
        } else if (err.message.includes('529')) {
          console.log('\n  ⏳ API sobrecargada, esperando 60s...');
          await sleep(60000);
        } else {
          console.log('\n  ❌ ' + err.message);
          if (retry < CONFIG.maxRetries - 1) await sleep(5000);
        }
      }
    }

    if (result && result.length > 0) {
      for (let j = 0; j < batch.length; j++) {
        const game = batch[j];
        const match = result.find(r => String(r.id) === String(game.id)) || result[j];

        if (match && match.type_ids && match.category_ids) {
          const validated = validateIds(match);
          retagged[String(game.id)] = {
            id: String(game.id),
            name: game.name,
            type_ids_new: validated.type_ids,
            category_ids_new: validated.category_ids,
            mechanic_ids_new: validated.mechanic_ids,
            // Keep old for comparison
            type_ids_old: game.type_ids || '',
            category_ids_old: game.category_ids || '',
            mechanic_ids_old: game.mechanic_ids || '',
          };
          processed++;
        } else {
          console.log('\n  ⚠️  Sin datos: ' + game.name);
          errors++;
        }
      }
      console.log('✅ (' + Object.keys(retagged).length + '/' + allGames.length + ')');
    } else {
      console.log('❌ Batch fallido');
      errors += batch.length;
    }

    // Save progress
    saveProgress(retagged, allGames, outputPath);

    if (i + CONFIG.batchSize < pending.length) await sleep(CONFIG.delayMs);
  }

  saveProgress(retagged, allGames, outputPath);

  console.log('\n════════════════════════════════════════════════');
  console.log('✅ Procesados: ' + processed);
  console.log('❌ Errores: ' + errors);
  console.log('📊 Total: ' + Object.keys(retagged).length + '/' + allGames.length);
  console.log('💾 Guardado: ' + outputPath);

  if (Object.keys(retagged).length >= allGames.length) {
    console.log('\n🎉 ¡Todos los juegos reetiquetados!');
    console.log('   Ahora ejecuta: node apply-tags.js');
  }
  console.log('════════════════════════════════════════════════\n');
}

function saveProgress(retagged, allGames, outputPath) {
  const output = {
    generated_at: new Date().toISOString(),
    total_games: allGames.length,
    retagged_count: Object.keys(retagged).length,
    games: allGames.map(g => {
      const r = retagged[String(g.id)];
      return {
        id: g.id,
        name: g.name,
        type_ids_new: r?.type_ids_new || null,
        category_ids_new: r?.category_ids_new || null,
        mechanic_ids_new: r?.mechanic_ids_new || null,
        type_ids_old: g.type_ids || '',
        category_ids_old: g.category_ids || '',
        mechanic_ids_old: g.mechanic_ids || '',
      };
    }),
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => { console.error('\n💥 Error fatal:', err.message); process.exit(1); });
