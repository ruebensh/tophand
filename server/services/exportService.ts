import ExcelJS from 'exceljs';
import { queryAll, runQuery } from '../db/database.ts';

/**
 * Faza 12 — Admin Excel import / export.
 * Entities are backed by a column whitelist. Export always dumps the full row
 * (SELECT *); import upserts only whitelisted columns, reporting per-row errors
 * so a single bad row never aborts the whole batch.
 */

export type ExportEntity =
  | 'users'
  | 'listings'
  | 'organizations'
  | 'categories'
  | 'regions'
  | 'districts';

interface EntityDef {
  table: string;
  // columns allowed to be written on import (id is always the conflict key)
  importColumns: string[];
  required: string[];
  label: string;
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
  },
  listings: {
    table: 'listings',
    importColumns: [
      'id', 'owner_user_id', 'organization_id', 'type', 'title', 'description',
      'category_id', 'region_id', 'district_id', 'price_type', 'status',
    ],
    required: ['id', 'owner_user_id', 'type', 'title', 'description', 'category_id', 'region_id', 'district_id'],
    label: "E'lonlar",
  },
  organizations: {
    table: 'organizations',
    importColumns: [
      'id', 'name', 'logo_url', 'description', 'phone', 'website',
      'region_id', 'district_id', 'address', 'owner_user_id', 'verification_status',
    ],
    required: ['id', 'name', 'owner_user_id'],
    label: 'Tashkilotlar',
  },
  categories: {
    table: 'categories',
    importColumns: [
      'id', 'catalog_id', 'name_uz', 'slug', 'icon', 'parent_id', 'is_active', 'sort_order',
    ],
    required: ['id', 'name_uz', 'slug'],
    label: 'Kategoriyalar',
  },
  regions: {
    table: 'regions',
    importColumns: ['id', 'name_uz', 'code', 'sort_order'],
    required: ['id', 'name_uz', 'code'],
    label: 'Viloyatlar',
  },
  districts: {
    table: 'districts',
    importColumns: ['id', 'region_id', 'name_uz', 'latitude', 'longitude', 'sort_order'],
    required: ['id', 'region_id', 'name_uz'],
    label: 'Tumanlar',
  },
};

export function isSupportedEntity(entity: string): entity is ExportEntity {
  return Object.prototype.hasOwnProperty.call(ENTITY_DEFS, entity);
}

/** Build an .xlsx buffer containing every row of the given entity table. */
export async function exportToXlsx(entity: ExportEntity): Promise<Buffer> {
  const def = ENTITY_DEFS[entity];
  const rows = await queryAll<Record<string, any>>(`SELECT * FROM ${def.table} ORDER BY created_at DESC NULLS LAST`);

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
  const placeholders = columnList.map(() => '?').join(', ');
  const updateClause = nonIdColumns.length
    ? `ON CONFLICT (id) DO UPDATE SET ${nonIdColumns.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`
    : 'ON CONFLICT (id) DO NOTHING';
  const hasUpdatedAt = await queryAll<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = ? AND column_name = 'updated_at'`,
    [def.table]
  );
  const sql =
    `INSERT INTO ${def.table} (${columnList.join(', ')}) VALUES (${placeholders}) ` +
    (hasUpdatedAt.length > 0
      ? updateClause
      : nonIdColumns.length
        ? `ON CONFLICT (id) DO UPDATE SET ${nonIdColumns.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}`
        : 'ON CONFLICT (id) DO NOTHING');

  // Gather data rows first, then upsert sequentially so the report is deterministic.
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

  for (const { rowNumber, values } of dataRows) {
    report.total++;

    // Required field validation
    let missing = false;
    for (const req of def.required) {
      if (values[req] === null || values[req] === undefined || values[req] === '') {
        report.errors.push({ row: rowNumber, message: `Majburiy maydon yetishmaydi: ${req}` });
        missing = true;
        break;
      }
    }
    if (missing) continue;

    const params = columnList.map((c) => values[c]);
    try {
      const r = await runQuery(sql, params);
      if (r.changes > 0) report.inserted++;
      else report.updated++;
    } catch (err: any) {
      report.errors.push({ row: rowNumber, message: err.message });
    }
  }

  return report;
}
