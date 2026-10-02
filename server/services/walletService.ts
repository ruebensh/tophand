import crypto from 'crypto';
import { runTransaction, queryAll, queryOne } from '../db/database.ts';

export class InsufficientFundsError extends Error {
  required: number;
  balance: number;
  constructor(required: number, balance: number) {
    super(`Balans yetarli emas. Talab qilinadigan: ${required}, mavjud: ${balance}`);
    this.name = 'InsufficientFundsError';
    this.required = required;
    this.balance = balance;
  }
}

interface TxMeta {
  ref_type?: string | null;
  ref_id?: string | null;
  note?: string | null;
}

/** Get current balance (creates wallet lazily with 0). */
export async function getBalance(userId: string): Promise<number> {
  const row = await queryOne<{ balance: string | number }>(
    'SELECT balance FROM wallets WHERE user_id = ?',
    [userId]
  );
  if (!row) {
    await runTransaction(async (client) => {
      await client.query(
        'INSERT INTO wallets (user_id, balance, updated_at) VALUES ($1, 0, NOW()) ON CONFLICT (user_id) DO NOTHING',
        [userId]
      );
    });
    return 0;
  }
  return Number(row.balance);
}

async function recordTx(
  client: any,
  userId: string,
  type: 'TOPUP' | 'SPEND' | 'REFUND' | 'ADJUST',
  amount: number,
  balanceAfter: number,
  meta: TxMeta = {}
) {
  const id = `wtx_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await client.query(
    `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, ref_type, ref_id, note, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
    [id, userId, type, amount, balanceAfter, meta.ref_type ?? null, meta.ref_id ?? null, meta.note ?? null]
  );
  return id;
}

/** Add funds to a user's balance. Returns new balance. */
export async function topUp(userId: string, amount: number, meta: TxMeta = {}): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Noto'g'ri summa");
  let newBalance = 0;
  await runTransaction(async (client) => {
    await client.query(
      'INSERT INTO wallets (user_id, balance, updated_at) VALUES ($1, 0, NOW()) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );
    const row = await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
    const balance = Number(row.rows[0]?.balance ?? 0);
    newBalance = balance + amount;
    await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2', [newBalance, userId]);
    await recordTx(client, userId, 'TOPUP', amount, newBalance, meta);
  });
  return newBalance;
}

/**
 * Deduct funds atomically. Throws InsufficientFundsError if balance < amount.
 * A no-op when amount <= 0 (e.g. FREE_TEST). Returns new balance.
 */
export async function charge(userId: string, amount: number, meta: TxMeta = {}): Promise<number> {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Noto'g'ri summa");
  if (amount === 0) return getBalance(userId);
  let newBalance = 0;
  await runTransaction(async (client) => {
    await client.query(
      'INSERT INTO wallets (user_id, balance, updated_at) VALUES ($1, 0, NOW()) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );
    const row = await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
    const balance = Number(row.rows[0]?.balance ?? 0);
    if (balance < amount) throw new InsufficientFundsError(amount, balance);
    newBalance = balance - amount;
    await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2', [newBalance, userId]);
    await recordTx(client, userId, 'SPEND', amount, newBalance, meta);
  });
  return newBalance;
}

/** Refund funds (e.g. listing removed during review). Returns new balance. */
export async function refund(userId: string, amount: number, meta: TxMeta = {}): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Noto'g'ri summa");
  let newBalance = 0;
  await runTransaction(async (client) => {
    await client.query(
      'INSERT INTO wallets (user_id, balance, updated_at) VALUES ($1, 0, NOW()) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );
    const row = await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
    const balance = Number(row.rows[0]?.balance ?? 0);
    newBalance = balance + amount;
    await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2', [newBalance, userId]);
    await recordTx(client, userId, 'REFUND', amount, newBalance, meta);
  });
  return newBalance;
}

/**
 * Refund a listing's one-time creation charge to its owner, at most once.
 * Used when staff/admin remove a paid listing so the user is made whole.
 * No-op in FREE_TEST (no LISTING_CREATE spend exists for the listing).
 */
export async function refundListingCreation(listingId: string): Promise<number> {
  const spend = await queryOne<{ amount: string | number }>(
    `SELECT COALESCE(SUM(amount), 0) AS amount FROM wallet_transactions
     WHERE ref_id = ? AND ref_type = 'LISTING_CREATE' AND type = 'SPEND'`,
    [listingId]
  );
  const amount = Number(spend?.amount ?? 0);
  if (amount <= 0) return 0;

  const already = await queryOne<{ id: string }>(
    `SELECT id FROM wallet_transactions
     WHERE ref_id = ? AND ref_type = 'LISTING_CREATE' AND type = 'REFUND' LIMIT 1`,
    [listingId]
  );
  if (already) return 0;

  const listing = await queryOne<{ owner_user_id: string }>('SELECT owner_user_id FROM listings WHERE id = ?', [listingId]);
  if (!listing) return 0;

  await refund(listing.owner_user_id, amount, { ref_type: 'LISTING_CREATE', ref_id: listingId, note: "E'lon olib tashlangani uchun to'lov qaytarildi" });
  return amount;
}

/** List a user's wallet transactions (newest first). */
export async function listTransactions(userId: string, limit = 50) {
  return queryAll(
    `SELECT id, type, amount, balance_after, ref_type, ref_id, note, created_at
     FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
}
