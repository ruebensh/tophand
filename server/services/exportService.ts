import ExcelJS from 'exceljs';
import { queryAll } from '../db/database.ts';

/**
 * Faza 12 — Admin Excel import / export.
 * Entities are backed by a column whitelist. Export always dumps the full row
 * (SELECT *); import upserts only whitelisted columns, reporting per-row errors
 * so a single bad row never aborts the whole batch.
 */

export type ExportEntity =
  | 'users'
  | 'listings'
  | 'categories'
  | 'regions'
  | 'districts';

interface EntityDef {
  table: string;
  // columns allowed to be written on import (id is always the conflict key)
  importColumns: string[];
  required: string[];
  label: string;
  // eksport saralashi — har jadvalda `created_at` YO'Q (regions/districts),
  // shuning uchun per-entity belgilanadi
  orderBy: string;
}

const ENTITY_DEFS: Record<ExportEntity, EntityDef> = {
  users: {
    table: 'users',
    importColumns: [
      'id', 'telegram_id', 'telegram_username', 'name', 'phone', 'bio',
      'region_id', 'district_id', 'latitude', 'longitude', 'role',
    ],
    required: ['id', 'name'],
    label: 'Foydalanuvchilar',
    orderBy: 'created_at DESC NULLS LAST',
  },
  listings: {
    table: 'listings',
    importColumns: [
      'id', 'owner_user_id', 'type', 'title', 'description',
      'category_id', 'region_id', 'district_id', 'price_type', 'status',
    ],
    required: ['id', 'owner_user_id', 'type', 'title', 'description', 'category_id', 'region_id', 'district_id'],
    label: "E'lonlar",
    orderBy: 'created_at DESC NULLS LAST',
  },
  categories: {
    table: 'categories',
    importColumns: [
      'id', 'catalog_id', 'name_uz', 'slug', 'icon', 'parent_id', 'is_active', 'sort_order',
    ],
    required: ['id', 'name_uz', 'slug'],
    label: 'Kategoriyalar',
    orderBy: 'created_at DESC NULLS LAST',
  },
  regions: {
    table: 'regions',
    importColumns: ['id', 'name_uz', 'code', 'sort_order'],
    required: ['id', 'name_uz', 'code'],
    label: 'Viloyatlar',
    orderBy: 'sort_order ASC, name_uz ASC',
  },
  districts: {
    table: 'districts',
    importColumns: ['id', 'region_id', 'name_uz', 'latitude', 'longitude', 'sort_order'],
    required: ['id', 'region_id', 'name_uz'],
    label: 'Tumanlar',
    orderBy: 'sort_order ASC, name_uz ASC',
  },
};

export function isSupportedEntity(entity: string): entity is ExportEntity {
  return Object.prototype.hasOwnProperty.call(ENTITY_DEFS, entity);
}

/** Build an .xlsx buffer containing every row of the given entity table. */
export async function exportToXlsx(entity: ExportEntity): Promise<Buffer> {
  const def = ENTITY_DEFS[entity];
  const rows = await queryAll<Record<string, any>>(`SELECT * FROM ${def.table} ORDER BY ${def.orderBy}`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TopHand Admin';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(def.label);

  const headers = rows.length > 0 ? Object.keys(rows[0]) : def.importColumns;
  sheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(14, h.length + 4) }));

  // Style the header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFEFEF' },
  };

  for (const row of rows) {
    const out: Record<string, any> = {};
    for (const h of headers) {
      const v = row[h];
      out[h] = v instanceof Date ? v.toISOString() : v;
    }
    sheet.addRow(out);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface ImportReport {
  entity: ExportEntity;
  total: number;
  inserted: number;
  updated: number;
  errors: { row: number; message: string }[];
}

function cellValue(cell: any): any {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'object') {
    if ('result' in cell) return cell.result; // formula
    if ('text' in cell) return cell.text; // rich text
    if (cell instanceof Date) return cell.toISOString();
  }
  const s = String(cell).trim();
  return s === '' ? null : cell;
}

/** Parse and upsert an .xlsx buffer into the given entity table. */
export async function importFromXlsx(entity: ExportEntity, buffer: Buffer): Promise<ImportReport> {
  const def = ENTITY_DEFS[entity];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];

  const report: ImportReport = { entity, total: 0, inserted: 0, updated: 0, errors: [] };
  if (!sheet) {
    report.errors.push({ row: 0, message: 'Excel faylida varaq topilmadi' });
    return report;
  }

  // Map header names (row 1) to column indexes
  const headerRow = sheet.getRow(1);
  const colIndexByName: Record<string, number> = {};
  headerRow.eachCell((cell: any, colNumber: number) => {
    const name = String(cell.value ?? '').trim().toLowerCase();
    if (name) colIndexByName[name] = colNumber;
  });

  const presentColumns = def.importColumns.filter((c) => colIndexByName[c] !== undefined);
  if (!colIndexByName['id']) {
    report.errors.push({ row: 0, message: "Import uchun 'id' ustunisi shart" });
    return report;
  }

  const nonIdColumns = presentColumns.filter((c) => c !== 'id');
  // Build a stable upsert SQL for this sheet
  const columnList = ['id', ...nonIdColumns];
  const groupPlaceholders = `(${columnList.map(() => '?').join(', ')})`;
  const setClause = nonIdColumns.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  const hasUpdatedAt = await queryAll<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = ? AND column_name = 'updated_at'`,
    [def.table]
  );
  const conflictAction = !nonIdColumns.length
    ? 'DO NOTHING'
    : hasUpdatedAt.length > 0
      ? `DO UPDATE SET ${setClause}, updated_at = NOW()`
      : `DO UPDATE SET ${setClause}`;
  // `xmax = 0` — qator shu INSERT'da YANGI yaratilganini bildiradi (insert/update
  // hisobini aniq ajratish uchun).
  const sqlFor = (rowCount: number) =>
    `INSERT INTO ${def.table} (${columnList.join(', ')}) VALUES ${Array(rowCount).fill(groupPlaceholders).join(', ')} ` +
    `ON CONFLICT (id) ${conflictAction} RETURNING id, (xmax = 0) AS is_new`;
  const paramsFor = (values: Record<string, any>) => columnList.map((c) => values[c]);

  // Gather data rows first, then upsert so the report is deterministic.
  const dataRows: { rowNumber: number; values: Record<string, any> }[] = [];
  sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return; // header
    const values: Record<string, any> = {};
    let emptyRow = true;
    for (const col of columnList) {
      const v = cellValue(row.getCell(colIndexByName[col]).value);
      if (v !== null && v !== undefined && v !== '') emptyRow = false;
      values[col] = v;
    }
    if (!emptyRow) dataRows.push({ rowNumber, values });
  });

  // BATCH upsert: har ~150 qatorga BITTA network round-trip. Avvalgi qatorma-qator
  // versiya uzoq (Neon) DB'ga juda sekin edi — Render'da so'ov timeout bo'lib,
  // gateway 502 qaytardi.
  const CHUNK = 150;
  for (let start = 0; start < dataRows.length; start += CHUNK) {
    const chunk = dataRows.slice(start, start + CHUNK);
    const valid: typeof chunk = [];
    for (const entry of chunk) {
      report.total++;
      // Required field validation
      let missing = false;
      for (const req of def.required) {
        if (entry.values[req] === null || entry.values[req] === undefined || entry.values[req] === '') {
          report.errors.push({ row: entry.rowNumber, message: `Majburiy maydon yetishmaydi: ${req}` });
          missing = true;
          break;
        }
      }
      if (!missing) valid.push(entry);
    }
    if (valid.length === 0) continue;

    const batchParams = valid.flatMap((v) => paramsFor(v.values));
    try {
      const returned = await queryAll<{ is_new: boolean }>(sqlFor(valid.length), batchParams);
      const insertedCount = returned.filter((r) => r.is_new === true).length;
      report.inserted += insertedCount;
      report.updated += returned.length - insertedCount;
    } catch {
      // Butun batch yiqildi (masalan bitta qatorda FK / type xatosi) — aniqlash
      // uchun shu batch'ni qatorma-qator qayta bajarib, qolganlarini saqlaymiz.
      for (const { rowNumber, values } of valid) {
        try {
          const res = await queryAll<{ is_new: boolean }>(sqlFor(1), paramsFor(values));
          if (res[0] && res[0].is_new === true) report.inserted++;
          else report.updated++;
        } catch (err: any) {
          report.errors.push({ row: rowNumber, message: err.message });
        }
      }
    }
  }

  return report;
}
