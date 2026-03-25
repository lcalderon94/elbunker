#!/usr/bin/env node
/**
 * ============================================================
 * apply-tags.js — Aplica las nuevas etiquetas a la BD
 * ============================================================
 * 
 * Lee games_retagged.json y actualiza las tablas:
 *   - GameType (borra las viejas, inserta las nuevas)
 *   - GameCategory (borra las viejas, inserta las nuevas)
 *   - GameMechanic (borra las viejas, inserta las nuevas)
 * 
 * USO:
 *   node apply-tags.js
 *   node apply-tags.js --dry-run     (solo muestra qué haría)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🏷️  ════════════════════════════════════════════════');
  console.log('   APPLY TAGS — Actualizar BD');
  console.log('   ════════════════════════════════════════════════\n');

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('🔵 DRY RUN — no se modificará la BD\n');

  // Find input file
  const possiblePaths = [
    'games_retagged.json',
    path.join(__dirname, 'games_retagged.json'),
    path.join(__dirname, 'prisma', 'games_retagged.json'),
  ];
  let inputFile = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) { inputFile = p; break; }
  }
  if (!inputFile) {
    console.error('❌ No encuentro games_retagged.json');
    console.error('   Primero ejecuta: node reassign-tags.js');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const games = (data.games || data).filter(g => g.type_ids_new && g.category_ids_new);

  console.log('📂 ' + inputFile);
  console.log('📋 Juegos con etiquetas nuevas: ' + games.length + '\n');

  let updated = 0, notFound = 0, errors = 0;

  for (const game of games) {
    try {
      // Find game in DB
      let dbGame = await prisma.game.findFirst({
        where: { externalId: parseInt(game.id) },
      });
      if (!dbGame) {
        dbGame = await prisma.game.findFirst({
          where: { name: { equals: game.name, mode: 'insensitive' } },
        });
      }
      if (!dbGame) {
        console.log('  ⚠️  No encontrado: ' + game.name);
        notFound++;
        continue;
      }

      const newTypeIds = (game.type_ids_new || '').split(',').map(Number).filter(Boolean);
      const newCatIds = (game.category_ids_new || '').split(',').map(Number).filter(Boolean);
      const newMechIds = (game.mechanic_ids_new || '').split(',').map(Number).filter(Boolean);

      if (dryRun) {
        const oldTypes = game.type_ids_old || '(vacío)';
        const oldCats = game.category_ids_old || '(vacío)';
        const oldMechs = game.mechanic_ids_old || '(vacío)';
        if (game.type_ids_new !== game.type_ids_old || 
            game.category_ids_new !== game.category_ids_old ||
            game.mechanic_ids_new !== game.mechanic_ids_old) {
          console.log('  ' + game.name + ':');
          if (game.type_ids_new !== game.type_ids_old)
            console.log('    Tipos:      ' + oldTypes + ' → ' + game.type_ids_new);
          if (game.category_ids_new !== game.category_ids_old)
            console.log('    Categorías: ' + oldCats + ' → ' + game.category_ids_new);
          if (game.mechanic_ids_new !== game.mechanic_ids_old)
            console.log('    Mecánicas:  ' + oldMechs + ' → ' + game.mechanic_ids_new);
        }
        updated++;
        continue;
      }

      // Use transaction: delete old relations + insert new ones
      await prisma.$transaction(async (tx) => {
        // Delete old
        await tx.gameType.deleteMany({ where: { gameId: dbGame.id } });
        await tx.gameCategory.deleteMany({ where: { gameId: dbGame.id } });
        await tx.gameMechanic.deleteMany({ where: { gameId: dbGame.id } });

        // Insert new types
        if (newTypeIds.length > 0) {
          await tx.gameType.createMany({
            data: newTypeIds.map(typeId => ({ gameId: dbGame.id, typeId })),
            skipDuplicates: true,
          });
        }

        // Insert new categories
        if (newCatIds.length > 0) {
          await tx.gameCategory.createMany({
            data: newCatIds.map(categoryId => ({ gameId: dbGame.id, categoryId })),
            skipDuplicates: true,
          });
        }

        // Insert new mechanics
        if (newMechIds.length > 0) {
          await tx.gameMechanic.createMany({
            data: newMechIds.map(mechanicId => ({ gameId: dbGame.id, mechanicId })),
            skipDuplicates: true,
          });
        }
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
  if (dryRun) console.log('🔵 (DRY RUN — nada fue modificado)');
  console.log('════════════════════════════════════════════════\n');

  if (!dryRun && updated > 0) {
    console.log('✅ ¡Hecho! Verifica con: npx prisma studio');
  }
}

main()
  .catch(e => { console.error('💥 Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
