import { Pool, PoolClient } from 'pg';
import { EXPOSED } from '../lib/envSecurity.ts';

// ─── Connection Pool ───────────────────────────────────────────────────
const isRemoteDb = Boolean(
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('127.0.0.1') &&
  !process.env.DATABASE_URL.includes('localhost')
);

// M-11: an internet-exposed environment MUST point at its own database. The
// hardcoded local fallback below is for development only — in any exposed env
// (production/staging/preview/unset NODE_ENV) we fail closed so a config drift
// can never silently connect to a known local credential.
if (!process.env.DATABASE_URL && EXPOSED) {
  throw new Error("FATAL: DATABASE_URL sozlanmagan — ochiq muhitda ishga tushirish taqiqlanadi.");
}

// H-04: for a remote database we verify the server certificate by default.
// Only set DB_SSL_REJECT_UNAUTHORIZED=false for a provider whose CA bundle you
// cannot install — never leave it off in production.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://tophand:tophand123@127.0.0.1:5432/tophand',
  ssl: isRemoteDb
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

export { pool };

function convertPlaceholders(sql: string): string {
  if (!sql.includes('?')) return sql;
  let idx = 1;
  return sql.replace(/'(?:''|[^'])*'|\?/g, (match) => {
    if (match === '?') {
      return `$${idx++}`;
    }
    return match;
  });
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const convertedSql = convertPlaceholders(sql);
  const res = await pool.query(convertedSql, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const convertedSql = convertPlaceholders(sql);
  const res = await pool.query(convertedSql, params);
  return res.rows.length > 0 ? (res.rows[0] as T) : null;
}

export async function runQuery(sql: string, params: any[] = []): Promise<{ changes: number }> {
  const convertedSql = convertPlaceholders(sql);
  const res = await pool.query(convertedSql, params);
  return { changes: res.rowCount ?? 0 };
}

export async function runTransaction(fn: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Compat shim — no-op for PostgreSQL (no file persistence needed)
export function persistDb() {}
export async function getDb() { return pool; }
