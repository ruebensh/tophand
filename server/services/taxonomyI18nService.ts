// ============================================================================
//  taxonomyI18nService — kategoriya / tuman / viloyat / katalog nomlarini
//  ru/en ga mashina-tarjimasi qilib, tegishli jadvallarning name_ru/name_en
//  ustunlariga yozadi (admin "backfill" harakati). Bu Google MT talab qiladi;
//  kalit bo'lmasa hech narsa qilmaydi (graceful).
// ============================================================================

import { queryAll, runQuery } from '../db/database.ts';
import { translateTexts, isTranslateConfigured } from './translateService.ts';

interface NameRow {
  id: string;
  name_uz: string;
}

interface BackfillResult {
  skipped?: boolean;
  reason?: string;
  counts: Record<string, { ru: number; en: number }>;
}

// Berilgan jadval uchun name_ru/name_en ni to'ldiradi (faqat bo'sh yoki force).
async function backfillTable(table: string, force: boolean): Promise<{ ru: number; en: number }> {
  const whereEmpty = force ? '' : 'WHERE (name_ru IS NULL OR name_en IS NULL)';
  const rows = await queryAll<NameRow>(`SELECT id, name_uz FROM ${table} ${whereEmpty}`);
  if (rows.length === 0) return { ru: 0, en: 0 };

  const names = rows.map((r) => r.name_uz);
  const result = { ru: 0, en: 0 };

  for (const target of ['ru', 'en'] as const) {
    const { translations } = await translateTexts(names, target);
    for (let i = 0; i < rows.length; i++) {
      const out = translations[i];
      if (!out) continue;
      const col = target === 'ru' ? 'name_ru' : 'name_en';
      await runQuery(`UPDATE ${table} SET ${col} = ? WHERE id = ?`, [out, rows[i].id]);
      result[target]++;
    }
  }
  return result;
}

const TABLES = ['catalogs', 'categories', 'regions', 'districts'];

export async function backfillTaxonomyTranslations(force = false): Promise<BackfillResult> {
  if (!isTranslateConfigured()) {
    return { skipped: true, reason: 'not-configured', counts: {} };
  }
  const counts: Record<string, { ru: number; en: number }> = {};
  for (const table of TABLES) {
    try {
      counts[table] = await backfillTable(table, force);
    } catch (err: any) {
      counts[table] = { ru: 0, en: 0 };
      console.error(`taxonomy backfill failed for ${table}:`, err?.message || err);
    }
  }
  return { counts };
}
