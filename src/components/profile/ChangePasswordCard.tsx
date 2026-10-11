import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useI18n } from '../../i18n/IntlContext.tsx';
import { Lock, Mail, KeyRound, ShieldCheck } from 'lucide-react';

/**
 * Profil sahifasidagi "Parolni o'zgartirish" kartasi.
 * Xavfsizlik talabi: eski parol kiritilmaydi — hisob email'iga yuboriladigan
 * 6 xonali kod tasdiqlanadi (POST /api/auth/change-password/{send-code,confirm}).
 * Paroli bo'lmagan (Google/Telegram) hisoblar uchun bu same oqim "parol o'rnatish"
 * vazifasini bajaradi va majburiy eslatma ko'rsatiladi.
 */
export const ChangePasswordCard: React.FC = () => {
  const { user, sendChangePasswordCode, changePasswordWithCode, refreshUser } = useAuth();
  const { t } = useI18n();

  const [phase, setPhase] = useState<'idle' | 'code'>('idle');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const hasPassword = Boolean(user?.has_password);
  const hasEmail = Boolean(user?.email);

  const reset = () => {
    setPhase('idle');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
  };

  const handleSendCode = async () => {
    setErrorMsg('');
    setOkMsg('');
    setSending(true);
    try {
      const res = await sendChangePasswordCode();
      setOkMsg(res.message || t('profile.alCodeSent'));
      if (res.demo_code) setCode(res.demo_code);
      setPhase('code');
    } catch (err: any) {
      setErrorMsg(err.message || t('profile.errPassChange'));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setOkMsg('');
    if (newPassword.length < 6) {
      setErrorMsg(t('profile.errPassLen'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('profile.errPassMismatch'));
      return;
    }
    setSaving(true);
    try {
      const res = await changePasswordWithCode(code.trim(), newPassword);
      setOkMsg(res.message || t('profile.passOk'));
      reset();
      refreshUser().catch(() => {});
    } catch (err: any) {
      setErrorMsg(err.message || t('profile.errPassChange'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs">
      <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-3 flex items-center gap-2">
        <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#1673E6]" />
        <span>{t('profile.passTitle')}</span>
      </h3>

      {/* Parol yo'q → majburiy eslatma */}
      {!hasPassword && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('profile.passMandatory')}</span>
        </p>
      )}

      {/* Email yo'q → kod yubora olmaymiz */}
      {!hasEmail ? (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 flex items-start gap-2">
          <Mail className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('profile.passEmailMissing')}</span>
        </p>
      ) : phase === 'idle' ? (
        <button
          type="button"
          onClick={handleSendCode}
          disabled={sending}
          className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sending ? <Lock className="w-4 h-4 animate-pulse" /> : <Mail className="w-4 h-4" />}
          <span>{hasPassword ? t('profile.passSendCode') : t('profile.passSendCodeSet')}</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            {okMsg || t('profile.passCodeSentTo', { email: user?.email || '' })}
          </p>

          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t('profile.passCodePh')}
              required
              className="w-full pl-10 pr-4 py-2.5 bg-blue-50/40 border border-blue-200 rounded-xl text-sm font-mono tracking-widest text-blue-900 font-bold focus:outline-hidden focus:border-blue-600 text-center"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">{t('profile.newPass')}</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">{t('profile.confirmPass')}</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 font-medium bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#1673E6] hover:bg-[#125FD0] text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {saving ? t('profile.changing') : t('profile.updatePass')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
