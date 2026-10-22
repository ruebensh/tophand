// Step-up parol tasdiq modali: xavfli admin amallari (rol almashtirish,
// obyekt o'chirish) oldidan parolni QAYTA so'raydi. api.ts'dagi
// ensureStepUpToken() shu modal orqali parolni oladi — yagona ko'prik
// registerStepUpPrompt() bilan o'rnatiladi.
// Eslatma: panel faqat uz tilida ishlatiladi (admin ichki vositasi), shuning
// uchun matnlar hardcode — i18n talab qilinmaydi.
import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { registerStepUpPrompt, fetchStepUpToken } from '../../lib/api.ts';

type PromptResult = string | null;

export function StepUpPromptModal() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const resolveRef = useRef<((value: PromptResult) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Modal mount bo'lganda api.ts uchun handler'ni ro'yxatdan o'tkazamiz;
  // unmount'da o'chiramiz (SPA'da takroriy mount'larda eski resolve qolmasin).
  // Handler resolve=qaytargan qiymat — TASDIQLANGAN step-up tokeni (yoki null).
  useEffect(() => {
    const prompt = () =>
      new Promise<string | null>((resolve) => {
        resolveRef.current = resolve;
        setPassword('');
        setError('');
        setOpen(true);
      });
    registerStepUpPrompt(prompt);
    return () => {
      registerStepUpPrompt(null);
      // Ochiq holda unmount bo'lsa — kutayotgan so'rovni bekor deb yopamiz.
      resolveRef.current?.(null);
      resolveRef.current = null;
    };
  }, []);

  // Modal ochilganda fokusni parol maydoniga o'tkazamiz.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const settle = (value: string | null) => {
    setOpen(false);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      // Parolni tekshirish — serverda (/api/auth/stepup). Muvaffaqiyatli
      // bo'lsa 10 daqiqalik token keladi va u chaqiruvchiga qaytariladi;
      // xato bo'lsa modlda qolamiz (limiter: 15 daq/8 urinish).
      const token = await fetchStepUpToken(password);
      settle(token);
    } catch (err: any) {
      setError(err?.message || 'Parol noto\'g\'ri');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60"
      onMouseDown={(e) => {
        // Orqa fon bosilsa — bekor (input focus'ini saqlab)
        if (e.target === e.currentTarget) settle(null);
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1673E6]">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-extrabold text-ink">Parolni qayta tasdiqlang</h3>
            <p className="mt-1 text-[13px] leading-snug text-gray-500">
              Bu xavfli amal uchun parolingizni qayta kiritishingiz shart.
            </p>
          </div>
          <button
            type="button"
            onClick={() => settle(null)}
            className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Bekor qilish"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Hisob parolingiz"
            autoComplete="current-password"
            className="w-full rounded-xl border border-[#E3E8EF] bg-[#FBFCFE] px-3 py-2.5 text-[14px] outline-none transition-colors focus:border-[#1673E6] focus:bg-white"
          />
          {error && <p className="mt-2 text-[12px] font-semibold text-red-600">{error}</p>}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => settle(null)}
              className="rounded-xl px-3.5 py-2 text-[13px] font-bold text-gray-600 transition-colors hover:bg-gray-100"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={!password.trim() || busy}
              className="th-accent-bg rounded-xl px-4 py-2 text-[13px] font-bold text-white transition-opacity disabled:opacity-50"
            >
              {busy ? 'Tekshirilmoqda…' : 'Tasdiqlash'}
            </button>
          </div>
        </form>
        <p className="mt-3 text-[11px] leading-snug text-gray-400">
          Tasdiqlashdan so'ng 10 daqiqa ichida xavfli amallarni parolsiz bajara olasiz.
        </p>
      </div>
    </div>
  );
}
