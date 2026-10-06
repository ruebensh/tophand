import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { X, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2, User, KeyRound } from 'lucide-react';
import { TopHandLogo } from '../common/TopHandLogo.tsx';
import { Modal } from '../common/Modal.tsx';
import { useI18n } from '../../i18n/IntlContext.tsx';

declare global {
  interface Window {
    google?: any;
  }
}

type AuthViewMode = 'login' | 'register' | 'register_code' | 'forgot_password' | 'enter_code';

export const GoogleLoginModal: React.FC = () => {
  const { t, intlLocale } = useI18n();
  const {
    isLoginModalOpen,
    closeLoginModal,
    loginWithGoogle,
    loginWithEmail,
    sendRegisterCode,
    registerWithEmail,
    sendPasswordResetCode,
    resetPasswordWithCode,
    isLoading,
  } = useAuth();

  const [mode, setMode] = useState<AuthViewMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleClientId, setGoogleClientId] = useState<string>(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || (window as any).__GOOGLE_CLIENT_ID__ || ''
  );

  // Fetch Google Client ID dynamically from backend if not yet present
  useEffect(() => {
    if (!googleClientId) {
      fetch('/api/auth/config')
        .then((res) => res.json())
        .then((data) => {
          if (data?.googleClientId) {
            setGoogleClientId(data.googleClientId);
          }
        })
        .catch(() => {});
    }
  }, [googleClientId]);

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (isLoginModalOpen) {
      setMode('login');
      setErrorMsg('');
      setSuccessMsg('');
      setPassword('');
      setNewPassword('');
      setVerificationCode('');
    }
  }, [isLoginModalOpen]);

  // Initialize Google Sign-In SDK
  useEffect(() => {
    if (!isLoginModalOpen || (mode !== 'login' && mode !== 'register')) return;

    const initGoogle = () => {
      const clientId = googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || (window as any).__GOOGLE_CLIENT_ID__ || '';
      if (!clientId || !window.google || !googleButtonRef.current) {
        return;
      }
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: false,
        });
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          text: mode === 'register' ? 'signup_with' : 'continue_with',
          shape: 'rectangular',
          width: 320,
          locale: intlLocale.slice(0, 2),
        });
      } catch (err) {
        console.error('Error rendering Google button:', err);
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
  }, [isLoginModalOpen, mode, googleClientId]);

  const handleGoogleCredentialResponse = async (response: any) => {
    setErrorMsg('');
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      await loginWithGoogle({
        credential: response.credential,
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.errGoogle'));
    }
  };



  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await loginWithEmail(email.trim(), password);
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.errCreds'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: send a verification code to the email before registering
  const handleSendRegisterCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const res = await sendRegisterCode(email.trim());
      setSuccessMsg(res.message || t('profile.alCodeSent'));
      if (res.demo_code) setVerificationCode(res.demo_code);
      setPassword('');
      setMode('register_code');
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.errCodeSend'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: confirm code + choose password → create account
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !verificationCode.trim() || !password) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await registerWithEmail(email.trim(), verificationCode.trim(), password);
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.errRegister'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Send Password Reset Code
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await sendPasswordResetCode(email.trim());
      setSuccessMsg(res.message || t('profile.alCodeSent'));
      if (res.demo_code) {
        setVerificationCode(res.demo_code);
      }
      setMode('enter_code');
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.errCodeSend'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Reset Password with Code
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim() || !newPassword) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await resetPasswordWithCode(email.trim(), verificationCode.trim(), newPassword);
      setSuccessMsg(res.message || t('auth.passUpdated'));
      setTimeout(() => {
        setMode('login');
        setPassword(newPassword);
        setSuccessMsg(t('auth.loginWithNewPass'));
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.errPassReset'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoginModalOpen) return null;

  return (
    <Modal
      isOpen={isLoginModalOpen}
      onClose={closeLoginModal}
      size="md"
      padded={false}
      header={
        <div className="px-6 sm:px-7 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <TopHandLogo size="sm" showText={true} />
          <button
            onClick={closeLoginModal}
            aria-label={t('common.close')}
            className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-[18px] h-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      }
    >
        <div className="p-6">
          {/* ════════════════════════════════════════════════════════════════
              1. LOGIN VIEW
          ════════════════════════════════════════════════════════════════ */}
          {mode === 'login' && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h3 className="text-base font-extrabold text-gray-950">{t('auth.welcome')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('auth.welcomeSub')}</p>
              </div>

              {/* Google Sign-in */}
              <div className="flex justify-center min-h-[44px]">
                <div ref={mode === 'login' ? googleButtonRef : undefined} className="flex justify-center" />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] font-medium text-gray-400">{t('auth.orEmail')}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Email + Password Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('profile.alEmailPh')}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:bg-white focus:border-blue-600 transition-all font-medium"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passPh')}
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:bg-white focus:border-blue-600 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                  >
                    {t('auth.forgotLink')}
                  </button>
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-600 font-medium bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">
                    {errorMsg}
                  </p>
                )}

                {successMsg && (
                  <p className="text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                    {successMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting || isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{t('auth.loginBtn')}</span>
                </button>
              </form>

              {/* Switch to Register */}
              <div className="text-center pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {t('auth.noAccount')}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    {t('auth.registerLink')}
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              2. REGISTER VIEW (step 1: email → send code)
          ════════════════════════════════════════════════════════════════ */}
          {mode === 'register' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-base font-extrabold text-gray-950">{t('auth.regTitle')}</h3>
                  <p className="text-xs text-gray-500">{t('auth.regSub')}</p>
                </div>
              </div>

              {/* Google Sign-up */}
              <div className="flex justify-center min-h-[44px]">
                <div ref={mode === 'register' ? googleButtonRef : undefined} className="flex justify-center" />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] font-medium text-gray-400">{t('auth.orEmail')}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <form onSubmit={handleSendRegisterCode} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('profile.alEmailPh')}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:bg-white focus:border-blue-600 transition-all font-medium"
                  />
                </div>

                <p className="text-[11px] text-gray-500">
                  {t('auth.regHint')}
                </p>

                {errorMsg && (
                  <p className="text-xs text-rose-600 font-medium bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">
                    {errorMsg}
                  </p>
                )}

                {successMsg && (
                  <p className="text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                    {successMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting || isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{t('auth.sendCodeBtn')}</span>
                </button>
              </form>

              <div className="text-center pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {t('auth.haveAccount')}{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    {t('auth.loginLink')}
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              2b. REGISTER CODE (step 2: confirm code + set password)
          ════════════════════════════════════════════════════════════════ */}
          {mode === 'register_code' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-base font-extrabold text-gray-950">{t('auth.codeTitle')}</h3>
                  <p className="text-xs text-gray-500">{t('auth.codeSentTo', { email })}</p>
                </div>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder={t('profile.alCodePh')}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-blue-50/40 border border-blue-200 rounded-xl text-sm font-mono tracking-widest text-blue-900 font-bold focus:outline-hidden focus:border-blue-600 text-center"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passPhMin')}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:bg-white focus:border-blue-600 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-600 font-medium bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting || isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{t('auth.createAccountBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendRegisterCode}
                  disabled={isSubmitting}
                  className="w-full text-center text-[11px] font-semibold text-gray-500 hover:text-gray-900 cursor-pointer"
                >
                  {t('auth.resendCode')}
                </button>
              </form>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              3. FORGOT PASSWORD (STEP 1: SEND CODE)
          ════════════════════════════════════════════════════════════════ */}
          {mode === 'forgot_password' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-base font-extrabold text-gray-950">{t('auth.resetTitle')}</h3>
                  <p className="text-xs text-gray-500">{t('auth.resetSub')}</p>
                </div>
              </div>

              <form onSubmit={handleSendResetCode} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.resetEmailPh')}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:bg-white focus:border-blue-600 transition-all font-medium"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-600 font-medium bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting || isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{t('auth.sendCodeBtn')}</span>
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-gray-500 hover:text-gray-900 font-semibold cursor-pointer"
                >
                  {t('auth.backBtn')}
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              4. ENTER CODE & SET NEW PASSWORD (STEP 2)
          ════════════════════════════════════════════════════════════════ */}
          {mode === 'enter_code' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setMode('forgot_password')}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-base font-extrabold text-gray-950">{t('auth.codeTitle')}</h3>
                  <p className="text-xs text-gray-500">{t('auth.codeSentTo', { email })}</p>
                </div>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                  <input
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder={t('auth.codePhExample')}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-blue-50/40 border border-blue-200 rounded-xl text-sm font-mono tracking-widest text-blue-900 font-bold focus:outline-hidden focus:border-blue-600 text-center"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('auth.newPassPh')}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:bg-white focus:border-blue-600 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-600 font-medium bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">
                    {errorMsg}
                  </p>
                )}

                {successMsg && (
                  <p className="text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting || isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{t('auth.updatePassBtn')}</span>
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-gray-500 hover:text-gray-900 font-semibold cursor-pointer"
                >
                  {t('auth.backToLogin')}
                </button>
              </div>
            </div>
          )}
        </div>
    </Modal>
  );
};
