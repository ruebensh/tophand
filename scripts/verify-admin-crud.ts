// Proves admin CRUD + persistence semantics:
//  1) admin-created attribute survives a full re-seed (initDatabase)
//  2) admin EDIT of a seeded attribute is NOT clobbered by re-seed (DO NOTHING)
//  3) reorder + delete behave as the admin panel expects
// Cleans up after itself so the DB is left pristine.
import dotenv from 'dotenv';
import { initDatabase } from '../server/db/init.ts';
import { queryOne, runQuery } from '../server/db/database.ts';

dotenv.config();

async function main() {
  await initDatabase(); // ensure baseline seed present

  const CAT = 'trn_avto';
  const TEST_KEY = 'zz_persist_test';
  const id = `attr_${CAT}_${TEST_KEY}`;

  // (1) Simulate admin POST /categories/:id/attributes
  await runQuery(
    `INSERT INTO category_attributes
       (id, category_id, key, label_uz, type, options, unit, required, filterable, sort_order,
        is_popular, popular_order, popular_values, section, meta)
     VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?::jsonb)
     ON CONFLICT (category_id, key) DO UPDATE SET label_uz = EXCLUDED.label_uz`,
    [id, CAT, TEST_KEY, 'Admin Test Filtr', 'select', JSON.stringify(['A', 'B']), null, 0, 1, 999, 0, 0, JSON.stringify([]), 'Asosiy', JSON.stringify({})]
  );

  // (2) Simulate admin EDIT of an existing seeded attribute (marka label)
  const marka = await queryOne<any>(`SELECT id, label_uz FROM category_attributes WHERE category_id=? AND key=?`, [CAT, 'marka']);
  const originalLabel = marka?.label_uz;
  await runQuery(`UPDATE category_attributes SET label_uz = ? WHERE id = ?`, ['ADMIN EDITED MARKA', marka.id]);

  // ── Now re-run the full seed (simulates a server restart) ──
  console.log('Re-seeding (simulating restart)…');
  await initDatabase();

  const testAfter = await queryOne<any>(`SELECT label_uz FROM category_attributes WHERE id=?`, [id]);
  const markaAfter = await queryOne<any>(`SELECT label_uz FROM category_attributes WHERE id=?`, [marka.id]);

  const testPersisted = testAfter?.label_uz === 'Admin Test Filtr';
  const editPersisted = markaAfter?.label_uz === 'ADMIN EDITED MARKA';

  console.log(`\n(1) admin-created attr survived re-seed: ${testPersisted ? '✅' : '❌'}`);
  console.log(`(2) admin edit NOT clobbered by re-seed:  ${editPersisted ? '✅' : '❌'} (label now "${markaAfter?.label_uz}", original was "${originalLabel}")`);

  // (3) reorder sanity: sort_order updates stick
  await runQuery(`UPDATE category_attributes SET sort_order = ? WHERE id = ?`, [12345, id]);
  const so = await queryOne<any>(`SELECT sort_order FROM category_attributes WHERE id=?`, [id]);
  console.log(`(3) reorder/sort_order persists:         ${Number(so?.sort_order) === 12345 ? '✅' : '❌'}`);

  // ── Cleanup: restore marka label + remove test attr ──
  await runQuery(`UPDATE category_attributes SET label_uz = ? WHERE id = ?`, [originalLabel, marka.id]);
  await runQuery(`DELETE FROM category_attributes WHERE id = ?`, [id]);
  const gone = await queryOne<any>(`SELECT id FROM category_attributes WHERE id=?`, [id]);
  console.log(`(4) delete works (cleanup):              ${!gone ? '✅' : '❌'}`);
  const restored = (await queryOne<any>(`SELECT label_uz FROM category_attributes WHERE id=?`, [marka.id]))?.label_uz === originalLabel;
  console.log(`(5) marka label restored to "${originalLabel}": ${restored ? '✅' : '❌'}`);

  const ok = testPersisted && editPersisted && !gone && restored;
  console.log(`\n${ok ? '✅ PERSISTENCE GUARANTEED' : '❌ PERSISTENCE PROBLEM'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
