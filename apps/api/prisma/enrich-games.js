#!/usr/bin/env node
/**
 * ============================================================
 * enrich-games.js — Genera description + gameplay para 585 juegos
 * ============================================================
 * 
 * Usa la API de Anthropic (Claude) para generar:
 *   - description: Descripción detallada del juego (temática, ambientación, narrativa)
 *   - gameplay: Cómo se juega (mecánicas, turnos, cómo ganas, decisiones)
 * 
 * REQUISITOS:
 *   - Node.js 18+
 *   - API key de Anthropic (https://console.anthropic.com)
 * 
 * USO:
 *   ANTHROPIC_API_KEY=sk-ant-xxx node enrich-games.js
 * 
 * OPCIONES:
 *   --batch-size=5    Juegos por llamada a la API (default: 5)
 *   --start=0         Empezar desde el juego N (para reanudar)
 *   --delay=1500      Delay entre llamadas en ms (default: 1500)
 *   --output=FILE     Archivo de salida (default: games_enriched.json)
 *   --input=FILE      Archivo de entrada (default: juegos.txt)
 *   --dry-run         No llama a la API, solo muestra qué haría
 * 
 * REANUDACIÓN:
 *   Si el script se interrumpe, vuelve a ejecutarlo. Detecta
 *   automáticamente qué juegos ya tienen descripción en el archivo
 *   de salida y los salta.
 * 
 * EJEMPLO:
 *   ANTHROPIC_API_KEY=sk-ant-xxx node enrich-games.js --batch-size=5 --delay=2000
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
  startFrom: parseInt(args['start']) || 0,
  delayMs: parseInt(args['delay']) || 1500,
  outputFile: args['output'] || 'games_enriched.json',
  inputFile: args['input'] || 'juegos.txt',
  dryRun: !!args['dry-run'],
  maxRetries: 3,
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

const SYSTEM_PROMPT = `Eres un experto en juegos de mesa con conocimiento enciclopédico. 
Tu trabajo es generar descripciones detalladas en ESPAÑOL para juegos de mesa.

Para cada juego debes generar DOS campos:

1. "description": Descripción detallada del juego (4-8 frases).
   - De qué va el juego: temática, ambientación, historia/narrativa
   - Qué lo hace especial o único
   - Para qué tipo de grupo es ideal (familias, gamers, fiestas, parejas...)
   - El tono/sensación al jugarlo (tenso, relajado, caótico, estratégico...)
   - Menciona si tiene algún premio o es un clásico reconocido si aplica

2. "gameplay": Cómo se juega (4-8 frases).
   - Qué hace cada jugador en su turno
   - Cuál es el objetivo para ganar
   - Qué tipo de decisiones se toman (colocar fichas, gestionar cartas, negociar, deducir...)
   - Interacción entre jugadores (cooperativo, competitivo, con traidor, negociación...)
   - Si tiene alguna mecánica destacada (drafting, deckbuilding, dados, roles ocultos, etc.)
   - Curva de aprendizaje: ¿es fácil de explicar? ¿se aprende rápido?

REGLAS:
- Escribe SIEMPRE en español
- Sé específico y detallado, no genérico
- NO inventes mecánicas que el juego no tiene
- Para expansiones, indica claramente que es una expansión y de qué juego base
- Para juegos con datos vacíos (0 jugadores, 0 duración), probablemente son expansiones
- Si no conoces un juego con certeza, indica lo que sepas y marca con [VERIFICAR]
- Responde SOLO con JSON válido, sin texto antes ni después
- No uses backticks markdown ni bloques de código`;

// ============================================================
// BATCH PROMPT
// ============================================================

function buildBatchPrompt(games) {
  const gamesInfo = games.map((g, i) => {
    const players = g.players || '0,0';
    const duration = g.duration || '0,0';
    const age = g.age || '0,100';
    const [pMin, pMax] = players.split(',').map(Number);
    const [dMin, dMax] = duration.split(',').map(Number);
    const [ageMin] = age.split(',').map(Number);
    const diff = g.difficulty || 0;

    return `JUEGO ${i + 1}:
  ID: ${g.id}
  Nombre: ${g.name}
  Jugadores: ${pMin}-${pMax}
  Duración: ${dMin}-${dMax} min
  Edad: ${ageMin}+
  Dificultad: ${diff}/5
  ¿Datos vacíos?: ${pMin === 0 && dMin === 0 ? 'SÍ (probablemente expansión)' : 'No'}`;
  }).join('\n\n');

  return `Genera description y gameplay en español para estos ${games.length} juegos.

${gamesInfo}

Responde SOLO con un JSON array así (sin backticks ni markdown):
[
  {
    "id": "1",
    "name": "Nombre del juego",
    "description": "Descripción detallada...",
    "gameplay": "Cómo se juega..."
  }
]`;
}

// ============================================================
// PARSE RESPONSE
// ============================================================

function parseResponse(text, expectedGames) {
  // Clean up common issues
  let cleaned = text.trim();
  
  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.games && Array.isArray(parsed.games)) return parsed.games;
    return [parsed];
  } catch (e) {
    // Try to extract JSON array from text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        console.error('  ⚠️  Could not parse JSON from response');
        console.error('  First 200 chars:', cleaned.substring(0, 200));
        return null;
      }
    }
    console.error('  ⚠️  No JSON array found in response');
    console.error('  First 200 chars:', cleaned.substring(0, 200));
    return null;
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('🎲 ════════════════════════════════════════════════');
  console.log('   ENRICH GAMES — Generador de descripciones');
  console.log('   ════════════════════════════════════════════════\n');

  // Validate API key
  if (!CONFIG.apiKey && !CONFIG.dryRun) {
    console.error('❌ Falta ANTHROPIC_API_KEY');
    console.error('   Uso: ANTHROPIC_API_KEY=sk-ant-xxx node enrich-games.js');
    console.error('   Consigue tu API key en: https://console.anthropic.com');
    process.exit(1);
  }

  // Load input games
  if (!fs.existsSync(CONFIG.inputFile)) {
    console.error(`❌ No se encuentra ${CONFIG.inputFile}`);
    console.error('   Copia juegos.txt al mismo directorio que este script');
    process.exit(1);
  }

  const inputData = JSON.parse(fs.readFileSync(CONFIG.inputFile, 'utf-8'));
  const allGames = inputData.games;
  console.log(`📂 Cargados ${allGames.length} juegos de ${CONFIG.inputFile}`);

  // Load existing progress (for resume)
  let enriched = {};
  if (fs.existsSync(CONFIG.outputFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(CONFIG.outputFile, 'utf-8'));
      const existingGames = existing.games || existing;
      if (Array.isArray(existingGames)) {
        for (const g of existingGames) {
          if (g.id && g.description && g.gameplay) {
            enriched[String(g.id)] = g;
          }
        }
      }
      console.log(`♻️  Encontrados ${Object.keys(enriched).length} juegos ya procesados en ${CONFIG.outputFile}`);
    } catch (e) {
      console.log(`⚠️  ${CONFIG.outputFile} existe pero no se pudo leer, empezando de cero`);
    }
  }

  // Filter out already-processed games
  const pending = allGames.filter(g => !enriched[String(g.id)]);
  console.log(`📋 Pendientes: ${pending.length} juegos`);

  if (pending.length === 0) {
    console.log('\n✅ ¡Todos los juegos ya están procesados!');
    return;
  }

  // Apply start offset
  const toProcess = pending.slice(CONFIG.startFrom);
  const totalBatches = Math.ceil(toProcess.length / CONFIG.batchSize);

  console.log(`\n⚙️  Configuración:`);
  console.log(`   Batch size: ${CONFIG.batchSize} juegos/llamada`);
  console.log(`   Delay: ${CONFIG.delayMs}ms entre llamadas`);
  console.log(`   Total batches: ${totalBatches}`);
  console.log(`   Modelo: ${CONFIG.model}`);
  if (CONFIG.dryRun) console.log(`   🔵 DRY RUN — no se llamará a la API`);
  console.log('');

  // Process in batches
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < toProcess.length; i += CONFIG.batchSize) {
    const batch = toProcess.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
    const batchNames = batch.map(g => g.name).join(', ');

    process.stdout.write(`[${batchNum}/${totalBatches}] ${batchNames.substring(0, 80)}... `);

    if (CONFIG.dryRun) {
      console.log('(dry run)');
      processed += batch.length;
      continue;
    }

    // Retry logic
    let result = null;
    for (let retry = 0; retry < CONFIG.maxRetries; retry++) {
      try {
        const prompt = buildBatchPrompt(batch);
        const response = await callAnthropic(prompt, SYSTEM_PROMPT);
        result = parseResponse(response, batch);

        if (result && result.length > 0) break;
        
        console.log(`\n  ⚠️  Respuesta vacía, reintento ${retry + 1}/${CONFIG.maxRetries}`);
      } catch (err) {
        if (err.message.includes('429') || err.message.includes('rate')) {
          console.log(`\n  ⏳ Rate limit, esperando 30s...`);
          await sleep(30000);
        } else if (err.message.includes('529') || err.message.includes('overloaded')) {
          console.log(`\n  ⏳ API sobrecargada, esperando 60s...`);
          await sleep(60000);
        } else {
          console.log(`\n  ❌ Error: ${err.message}`);
          if (retry < CONFIG.maxRetries - 1) {
            console.log(`  Reintento ${retry + 1}/${CONFIG.maxRetries} en 5s...`);
            await sleep(5000);
          }
        }
      }
    }

    if (result && result.length > 0) {
      // Match results to input games by ID or position
      for (let j = 0; j < batch.length; j++) {
        const game = batch[j];
        // Try to find by ID first, then by position
        const match = result.find(r => String(r.id) === String(game.id)) || result[j];
        
        if (match && match.description && match.gameplay) {
          enriched[String(game.id)] = {
            id: String(game.id),
            name: game.name,
            description: match.description,
            gameplay: match.gameplay,
          };
          processed++;
        } else {
          console.log(`\n  ⚠️  Sin datos para: ${game.name}`);
          errors++;
        }
      }
      console.log(`✅ (${Object.keys(enriched).length}/${allGames.length})`);
    } else {
      console.log(`❌ Batch fallido`);
      errors += batch.length;
    }

    // Save progress after each batch
    saveProgress(enriched, allGames);

    // Delay between calls
    if (i + CONFIG.batchSize < toProcess.length) {
      await sleep(CONFIG.delayMs);
    }
  }

  // Final save
  saveProgress(enriched, allGames);

  // Summary
  console.log('\n════════════════════════════════════════════════');
  console.log(`✅ Procesados: ${processed}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`📊 Total con descripción: ${Object.keys(enriched).length}/${allGames.length}`);
  console.log(`💾 Guardado en: ${CONFIG.outputFile}`);
  
  if (Object.keys(enriched).length < allGames.length) {
    const missing = allGames.length - Object.keys(enriched).length;
    console.log(`\n⚠️  Faltan ${missing} juegos. Ejecuta el script de nuevo para reintentar.`);
  } else {
    console.log(`\n🎉 ¡Todos los juegos procesados!`);
  }
  console.log('════════════════════════════════════════════════\n');
}

// ============================================================
// HELPERS
// ============================================================

function saveProgress(enriched, allGames) {
  // Merge enriched data back into original game structure
  const output = {
    generated_at: new Date().toISOString(),
    total_games: allGames.length,
    enriched_count: Object.keys(enriched).length,
    games: allGames.map(g => {
      const e = enriched[String(g.id)];
      return {
        ...g,
        description: e?.description || null,
        gameplay: e?.gameplay || null,
      };
    }),
  };

  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2), 'utf-8');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// RUN
// ============================================================

main().catch(err => {
  console.error('\n💥 Error fatal:', err.message);
  process.exit(1);
});
