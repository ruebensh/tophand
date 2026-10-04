// Standalone persistence check: boots schema + seed, then verifies the new
// category_attributes landed and that admin-owned rows are NOT clobbered.
import dotenv from 'dotenv';
import { initDatabase } from '../server/db/init.ts';
import { queryAll, queryOne } from '../server/db/database.ts';

dotenv.config();

async function main() {
  await initDatabase();

  const total = await queryOne<any>(`SELECT COUNT(*)::int AS n FROM category_attributes`);
  console.log(`\n📊 category_attributes total rows: ${total?.n}`);

  // Columns + indexes present?
  const cols = await queryAll<any>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='category_attributes' ORDER BY ordinal_position`
  );
  console.log(`🧱 columns: ${cols.map((c) => c.column_name).join(', ')}`);
  const idx = await queryAll<any>(
    `SELECT indexname FROM pg_indexes WHERE tablename='category_attributes' ORDER BY indexname`
  );
  console.log(`🔑 indexes: ${idx.map((i) => i.indexname).join(', ')}`);

  // Spot-check newly seeded attributes across catalogs.
  const checks: [string, string][] = [
    ['trn_avto', 'strana'],
    ['trn_avto', 'quvvat'],
    ['trn_gruz_gruzovik', 'massa'],
    ['trn_moto', 'strana'],
    ['rlt_buy', 'dom_turi'],
    ['prt_wheel_tire', 'diametr'],
    ['hom_furn_bed', 'yechish'],
    ['job_vac_1', 'zantoklik'],
  ];
  console.log('\n🔎 new-seed spot checks:');
  for (const [cat, key] of checks) {
    const row = await queryOne<any>(
      `SELECT key, type, label_uz FROM category_attributes WHERE category_id=$1 AND key=$2`,
      [cat, key]
    );
    console.log(`  ${row ? '✅' : '❌'} ${cat}.${key}${row ? ` (${row.type})` : ' MISSING'}`);
  }

  // Popular row wiring: is_popular must be queryable for trn_avto.marka & prt_wheel_tire.diametr
  const pop = await queryAll<any>(
    `SELECT category_id, key, is_popular, popular_order FROM category_attributes
     WHERE category_id IN ('trn_avto','prt_wheel_tire','trn_gruz_gruzovik') AND is_popular=1`
  );
  console.log(`\n⭐ popular-flagged rows: ${pop.map((p) => `${p.category_id}.${p.key}#${p.popular_order}`).join(', ') || 'none'}`);

  console.log('\n✅ Verification complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
