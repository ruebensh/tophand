import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { Mail, ShieldCheck, Loader2, CheckCircle2, KeyRound } from 'lucide-react';
import { useI18n } from '../../i18n/IntlContext.tsx';

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * Owner-only card on the profile page: link an email to a Google account
 * (verified with a code, exactly like sign-up) or connect Google to an email
 * account. This is what lets a user sign in through either method later.
 */
export const AccountLinkingCard: React.FC = () => {
  const { t, intlLocale } = useI18n();
  const { user, sendLinkEmailCode, verifyLinkEmail, linkGoogle } = useAuth();

  const [emailStep, setEmailStep] = useState<'idle' | 'code'>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [googleClientId, setGoogleClientId] = useState<string>(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || (window as any).__GOOGLE_CLIENT_ID__ || ''
  );

  useEffect(() => {
    if (!googleClientId) {
      fetch('/api/auth/config')
        .then((r) => r.json())
        .then((d) => d?.googleClientId && setGoogleClientId(d.googleClientId))
        .catch(() => {});
    }
  }, [googleClientId]);

  // Render the Google "connect" button when the account has no Google link yet.
  useEffect(() => {
    if (!user || user.has_google || !googleClientId) return;

    const initGoogle = () => {
      if (!window.google || !googleBtnRef.current) return;
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleLink,
          auto_select: false,
          cancel_on_tap_outside: false,
        });
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'medium',
          text: 'continue_with',
          shape: 'rectangular',
          locale: intlLocale.slice(0, 2),
        });
      } catch (err) {
        console.error('Google link button error:', err);
      }
    };

    if (!window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    } else {
      initGoogle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, googleClientId]);

  if (!user) return null;

  const handleGoogleLink = async (response: any) => {
    setError('');
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      await linkGoogle({
        credential: response.credential,
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });
      setNotice(t('profile.alGoogleOk'));
    } catch (err: any) {
      setError(err.message || t('profile.alGoogleErr'));
    }
  };

  const handleSendEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const res = await sendLinkEmailCode(email.trim());
      if (res.demo_code) setCode(res.demo_code);
      setEmailStep('code');
      setNotice(res.message || t('profile.alCodeSent'));
    } catch (err: any) {
      setError(err.message || t('profile.alCodeErr'));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await verifyLinkEmail(email.trim(), code.trim());
      setEmailStep('idle');
      setEmail('');
      setCode('');
      setNotice(t('profile.alEmailOk'));
    } catch (err: any) {
      setError(err.message || t('profile.alEmailErr'));
    } finally {
      setBusy(false);
    }
  };

  const emailLinked = Boolean(user.email) && user.email_verified;

  return (
    <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-2xs">
      <h4 className="text-sm font-extrabold text-gray-900 mb-1">{t('profile.alTitle')}</h4>
      <p className="text-[11px] text-gray-500 mb-4">
        {t('profile.alSub')}
      </p>

      {error && (
        <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>
      )}
      {notice && !error && (
        <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">{notice}</div>
      )}

      {/* Email row */}
      <div className="py-3 border-t border-gray-100 first:border-t-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800">Email</p>
              <p className="text-[11px] text-gray-500 truncate">
                {emailLinked ? user.email : user.email ? `${user.email} (${t('profile.alUnverified')})` : t('profile.alEmailNone')}
              </p>
            </div>
          </div>
          {emailLinked ? (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <ShieldCheck className="w-4 h-4" /> {t('profile.alLinked')}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => { setEmailStep('idle'); setError(''); setNotice(''); }}
              className="shrink-0 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              {user.email ? t('common.confirm') : t('profile.alAddEmail')}
            </button>
          )}
        </div>

        {!emailLinked && emailStep === 'idle' && (
          <form onSubmit={handleSendEmailCode} className="mt-3 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('profile.alEmailPh')}
              required
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('profile.alSendCode')}
            </button>
          </form>
        )}

        {!emailLinked && emailStep === 'code' && (
          <form onSubmit={handleVerifyEmail} className="mt-3 flex gap-2">
            <div className="relative flex-1 min-w-0">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={t('profile.alCodePh')}
                required
                className="w-full pl-9 pr-3 py-2 bg-blue-50/40 border border-blue-200 rounded-xl text-xs font-mono tracking-widest text-blue-900 font-bold focus:outline-hidden focus:border-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('common.confirm')}
            </button>
          </form>
        )}
      </div>

      {/* Google row */}
      <div className="py-3 border-t border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 text-xs font-black text-gray-600">
              G
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800">Google</p>
              <p className="text-[11px] text-gray-500">{user.has_google ? t('profile.alGoogleLinked') : t('profile.alGoogleNone')}</p>
            </div>
          </div>
          {user.has_google && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> {t('profile.alLinked')}
            </span>
          )}
        </div>
        {!user.has_google && (
          <div ref={googleBtnRef} className="mt-3 flex justify-start min-h-[36px]" />
        )}
      </div>
    </div>
  );
};

export default AccountLinkingCard;
