#!/usr/bin/env node
/**
 * update-descriptions.js — Mete description + gameplay en PostgreSQL
 * 
 * USO:
 *   node update-descriptions.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🎲 ════════════════════════════════════════════════');
  console.log('   UPDATE GAME DESCRIPTIONS');
  console.log('   ════════════════════════════════════════════════\n');

  // Buscar el archivo en varias ubicaciones posibles
  const possiblePaths = [
    path.join(__dirname, 'games_enriched.json'),
    path.join(__dirname, 'prisma', 'games_enriched.json'),
    path.join(__dirname, '..', 'games_enriched.json'),
    'games_enriched.json',
  ];

  let inputFile = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      inputFile = p;
      break;
    }
  }

  // También comprobar si pasaron --input
  const inputArg = process.argv.find(a => a.startsWith('--input='));
  if (inputArg) {
    const custom = inputArg.split('=')[1];
    if (fs.existsSync(custom)) inputFile = custom;
  }

  if (!inputFile) {
    console.error('❌ No encuentro games_enriched.json');
    console.error('   Lo he buscado en:');
    possiblePaths.forEach(p => console.error('   - ' + p));
    console.error('\n   Pon games_enriched.json en la misma carpeta que este script');
    process.exit(1);
  }

  console.log('📂 Leyendo: ' + inputFile);

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const games = data.games || data;
  const withDesc = games.filter(g => g.description && g.gameplay);

  console.log('📋 Total juegos: ' + games.length);
  console.log('📋 Con descripción: ' + withDesc.length + '\n');

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const game of withDesc) {
    try {
      // Buscar por externalId primero
      let existing = await prisma.game.findFirst({
        where: { externalId: parseInt(game.id) },
      });

      // Si no, buscar por nombre
      if (!existing) {
        existing = await prisma.game.findFirst({
          where: { name: { equals: game.name, mode: 'insensitive' } },
        });
      }

      if (!existing) {
        console.log('  ⚠️  No encontrado: ' + game.name);
        notFound++;
        continue;
      }

      await prisma.game.update({
        where: { id: existing.id },
        data: {
          description: game.description,
          gameplay: game.gameplay,
        },
      });

      updated++;
      if (updated % 50 === 0) {
        console.log('  ... ' + updated + ' juegos actualizados');
      }
    } catch (err) {
      console.log('  ❌ Error en ' + game.name + ': ' + err.message);
      errors++;
    }
  }

  console.log('\n════════════════════════════════════════════════');
  console.log('✅ Actualizados: ' + updated);
  console.log('⚠️  No encontrados: ' + notFound);
  console.log('❌ Errores: ' + errors);
  console.log('════════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('💥 Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
