import { Pool, PoolClient } from 'pg';

// ─── Connection Pool ───────────────────────────────────────────────────
const isRemoteDb = Boolean(
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('127.0.0.1') &&
  !process.env.DATABASE_URL.includes('localhost')
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://tophand:tophand123@127.0.0.1:5432/tophand',
  ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
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
