import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { X, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2, User, KeyRound } from 'lucide-react';
import { TopHandLogo } from '../common/TopHandLogo.tsx';

declare global {
  interface Window {
    google?: any;
  }
}

type AuthViewMode = 'login' | 'register' | 'forgot_password' | 'enter_code';

export const GoogleLoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    closeLoginModal,
    loginWithGoogle,
    loginWithEmail,
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
    if (!isLoginModalOpen || mode !== 'login') return;

    const initGoogle = () => {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || (window as any).__GOOGLE_CLIENT_ID__ || '';
      if (!clientId) {
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: false,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320,
        locale: 'uz',
      });
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
  }, [isLoginModalOpen, mode]);

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
      setErrorMsg(err.message || "Google orqali kirishda xatolik yuz berdi");
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
      setErrorMsg(err.message || "Email yoki parol noto'g'ri");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await registerWithEmail(name.trim(), email.trim(), password);
    } catch (err: any) {
      setErrorMsg(err.message || "Ro'yxatdan o'tishda xatolik yuz berdi");
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
      setSuccessMsg(res.message || 'Tasdiqlash kodi emailingizga yuborildi');
      if (res.demo_code) {
        setVerificationCode(res.demo_code);
      }
      setMode('enter_code');
    } catch (err: any) {
      setErrorMsg(err.message || 'Kodni yuborishda xatolik yuz berdi');
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
      setSuccessMsg(res.message || 'Parol muvaffaqiyatli yangilandi');
      setTimeout(() => {
        setMode('login');
        setPassword(newPassword);
        setSuccessMsg('Yangi parol bilan tizimga kiring');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Parolni yangilashda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoginModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TopHandLogo size="sm" showText={true} />
          </div>
          <button
            onClick={closeLoginModal}
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* ════════════════════════════════════════════════════════════════
              1. LOGIN VIEW
          ════════════════════════════════════════════════════════════════ */}
          {mode === 'login' && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h3 className="text-base font-extrabold text-gray-950">Xush kelibsiz!</h3>
                <p className="text-xs text-gray-500 mt-0.5">TopHand xizmatlari va e’lonlar platformasi</p>
              </div>

              {/* Google Sign-in */}
              <div>
                <div ref={googleButtonRef} className="flex justify-center" />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] font-medium text-gray-400">yoki email orqali</span>
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
                    placeholder="Email manzilingiz"
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
                    placeholder="Parol"
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
                    Parolni unutdingizmi?
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
                  <span>Tizimga kirish</span>
                </button>
              </form>

              {/* Switch to Register */}
              <div className="text-center pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Hisobingiz yo‘qmi?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    Ro‘yxatdan o‘tish
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              2. REGISTER VIEW
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
                  <h3 className="text-base font-extrabold text-gray-950">Yangi hisob yaratish</h3>
                  <p className="text-xs text-gray-500">TopHand oilasiga qo‘shiling</p>
                </div>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ism va familiyangiz"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:bg-white focus:border-blue-600 transition-all font-medium"
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email manzilingiz"
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
                    placeholder="Parol (kamida 6 ta belgi)"
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
                  <span>Ro‘yxatdan o‘tish</span>
                </button>
              </form>

              <div className="text-center pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Hisobingiz bormi?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    Kirish
                  </button>
                </p>
              </div>
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
                  <h3 className="text-base font-extrabold text-gray-950">Parolni tiklash</h3>
                  <p className="text-xs text-gray-500">Emailingizga tasdiqlash kodi yuboramiz</p>
                </div>
              </div>

              <form onSubmit={handleSendResetCode} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Hisobingiz email manzili"
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
                  <span>Tasdiqlash kodini yuborish</span>
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-gray-500 hover:text-gray-900 font-semibold cursor-pointer"
                >
                  Ortga qaytish
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
                  <h3 className="text-base font-extrabold text-gray-950">Kodni kiriting</h3>
                  <p className="text-xs text-gray-500">
                    <strong>{email}</strong> manziliga 6 xonali kod yuborildi
                  </p>
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
                    placeholder="6 xonali kod (masalan: 123456)"
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
                    placeholder="Yangi parol (kamida 6 ta belgi)"
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
                  <span>Parolni yangilash va kirish</span>
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-gray-500 hover:text-gray-900 font-semibold cursor-pointer"
                >
                  Kirish sahifasiga qaytish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
