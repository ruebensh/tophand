import React, { useState, useEffect } from 'react';
import { getWallet, topUpWallet, type WalletInfo } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Wallet,
  Plus,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';

interface WalletPageProps {
  onNavigate: (route: string) => void;
}

const TX_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  TOPUP: { label: 'To‘ldirish', icon: <ArrowDownLeft className="w-4 h-4" />, cls: 'text-emerald-600 bg-emerald-50' },
  SPEND: { label: 'Sarflash', icon: <ArrowUpRight className="w-4 h-4" />, cls: 'text-rose-600 bg-rose-50' },
  REFUND: { label: 'Qaytarish', icon: <RotateCcw className="w-4 h-4" />, cls: 'text-blue-600 bg-blue-50' },
  ADJUST: { label: 'O‘zgartirish', icon: <RefreshCw className="w-4 h-4" />, cls: 'text-gray-600 bg-gray-100' },
};

const PRESETS = [10000, 25000, 50000, 100000];

const fmt = (n: number) => `${Number(n).toLocaleString('uz-UZ')} so‘m`;

export const WalletPage: React.FC<WalletPageProps> = ({ onNavigate }) => {
  const { user, openLoginModal } = useAuth();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [amount, setAmount] = useState<string>('');
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchWallet = async () => {
    setIsLoading(true);
    try {
      const data = await getWallet();
      setWallet(data);
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message || 'Balansni yuklashda xatolik' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchWallet();
    else setIsLoading(false);
  }, [user]);

  const handleTopUp = async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 100) {
      setMsg({ type: 'err', text: 'Summa kamida 100 so‘m bo‘lishi kerak' });
      return;
    }
    setIsToppingUp(true);
    setMsg(null);
    try {
      const res = await topUpWallet(value);
      setWallet((prev) => ({
        balance: res.balance,
        currency: prev?.currency || 'UZS',
        transactions: prev?.transactions || [],
      }));
      setAmount('');
      setMsg({ type: 'ok', text: 'Balans to‘ldirildi (demo). To‘lov tizimi keyinroq ulanadi.' });
      fetchWallet();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message || 'To‘ldirishda xatolik' });
    } finally {
      setIsToppingUp(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mx-auto mb-3">
          <Wallet className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Balans sahifasi</h2>
        <p className="text-xs text-gray-500 mt-1 mb-6">Balansni ko‘rish uchun tizimga kiring.</p>
        <button
          onClick={() => openLoginModal()}
          className="px-6 py-2.5 rounded-full bg-blue-600 text-white font-bold text-xs shadow-md"
        >
          Kirish
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <button
        onClick={() => onNavigate('/')}
        className="text-xs font-bold text-gray-500 hover:text-blue-600 mb-4 cursor-pointer"
      >
        ‹ Bosh sahifa
      </button>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg mb-5">
        <div className="flex items-center gap-2 text-blue-100 text-xs font-bold uppercase tracking-wider">
          <Wallet className="w-4 h-4" /> Mening balansim
        </div>
        <p className="text-3xl sm:text-4xl font-black mt-2">
          {isLoading ? '...' : fmt(wallet?.balance ?? 0)}
        </p>
        <p className="text-[11px] text-blue-200 mt-2">
          Balansdan e'lon joylash va topga ko'tarish (promo) uchun foydanasiz.
        </p>
      </div>

      {/* Top-up */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-4 sm:p-5 mb-5">
        <h3 className="font-bold text-sm text-gray-900 mb-3">Balansni to‘ldirish</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(String(p))}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                amount === String(p)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              +{p.toLocaleString('uz-UZ')}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Summa (so‘m)"
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleTopUp}
            disabled={isToppingUp}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isToppingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>To‘ldirish</span>
          </button>
        </div>
        {msg && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs font-semibold ${
              msg.type === 'ok'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}
          >
            {msg.text}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-900">Amallar tarixi</h3>
          <button onClick={fetchWallet} className="text-gray-400 hover:text-blue-600 cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {!wallet || wallet.transactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">Hali amallar mavjud emas.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {wallet.transactions.map((tx: any) => {
              const meta = TX_META[tx.type] || TX_META.ADJUST;
              const isMinus = tx.type === 'SPEND';
              return (
                <div key={tx.id} className="p-3.5 sm:p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${meta.cls}`}>{meta.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">{meta.label}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {tx.note || tx.ref_type || '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(tx.created_at).toLocaleString('uz-UZ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black ${isMinus ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {isMinus ? '−' : '+'}
                      {Number(tx.amount).toLocaleString('uz-UZ')}
                    </p>
                    <p className="text-[10px] text-gray-400">Qoldiq: {Number(tx.balance_after).toLocaleString('uz-UZ')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
