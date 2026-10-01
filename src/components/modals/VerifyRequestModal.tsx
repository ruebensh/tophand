import React, { useEffect, useState } from 'react';
import { ShieldCheck, Upload, Loader2, Check, Image as ImageIcon, Lock } from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { apiRequest, uploadImageFile } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface VerifyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

/**
 * "Tasdiq nishoni olish" — foydalanuvchi pasport ma'lumoti + rasmini yuboradi.
 * Mobil qurilmalarda Modal avtomatik pastdan ochiluvchi (bottom-sheet) ko'rinishda bo'ladi.
 */
export const VerifyRequestModal: React.FC<VerifyRequestModalProps> = ({ isOpen, onClose, onSubmitted }) => {
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [pinfl, setPinfl] = useState('');
  const [series, setSeries] = useState('');
  const [number, setNumber] = useState('');
  const [issuedBy, setIssuedBy] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Ochilganda mavjud ma'lumotlar bilan to'ldirish
  useEffect(() => {
    if (!isOpen) return;
    setFullName(user?.full_legal_name || user?.name || '');
    setBirthDate(user?.birth_date || '');
    setPinfl(user?.pinfl || '');
    setSeries(user?.passport_series || '');
    setNumber(user?.passport_number || '');
    setIssuedBy(user?.passport_issued_by || '');
    setIssuedDate(user?.passport_issued_date || '');
    setPhotoUrl(user?.verification_photo_url || '');
    setError('');
    setIsSuccess(false);
    setIsSubmitting(false);
    setIsUploading(false);
  }, [isOpen, user]);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setIsUploading(true);
    try {
      const url = await uploadImageFile(file, 'verifications');
      setPhotoUrl(url);
    } catch (err: any) {
      setError(err.message || 'Rasm yuklashda xatolik');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (fullName.trim().split(/\s+/).length < 2) {
      setError("To'liq ism familiya kamida 2 ta so'zdan iborat bo'lsin");
      return;
    }
    if (!/^\d{14}$/.test(pinfl.trim())) {
      setError('PINFL 14 ta raqamdan iborat bo’lishi kerak');
      return;
    }
    if (!series.trim() || !number.trim()) {
      setError('Pasport seriyasi va raqamini to’ldiring');
      return;
    }
    if (!photoUrl) {
      setError('Pasport yuzasi yoki selfie rasmini yuklang');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/api/users/me/verification', {
        method: 'POST',
        body: JSON.stringify({
          full_legal_name: fullName.trim(),
          birth_date: birthDate.trim() || undefined,
          pinfl: pinfl.trim(),
          passport_series: series.trim(),
          passport_number: number.trim(),
          passport_issued_by: issuedBy.trim() || undefined,
          passport_issued_date: issuedDate.trim() || undefined,
          verification_photo_url: photoUrl,
        }),
      });
      await refreshUser();
      setIsSuccess(true);
      onSubmitted?.();
    } catch (err: any) {
      setError(err.message || 'Arizani yuborishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls =
    'w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-3.5 text-base sm:text-sm font-medium text-gray-900 focus:outline-hidden focus:bg-white focus:border-[#1673E6] focus:ring-2 focus:ring-blue-100 transition-colors';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isSuccess ? undefined : 'Tasdiq nishonini olish'} size="md">
      {isSuccess ? (
        <div className="py-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <Check className="w-8 h-8" strokeWidth={3} />
          </div>
          <p className="font-bold text-base text-gray-950">Arizangiz yuborildi</p>
          <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
            Ma’muriyat (moderatorlar) pasport ma’lumotlaringizni tekshirib, tez orada natija haqida xabar beradi.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 h-11 px-8 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold transition-colors cursor-pointer"
          >
            Yopish
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/60 border border-blue-100">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 leading-relaxed">
              Tasdiq nishoni profilingiz va e’lonlaringizga ishonchni oshiradi. Ma’lumotlaringiz faqat tekshiruv uchun
              ishlatiladi va boshqa foydalanuvchilarga ko’rsatilmaydi.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium">{error}</div>
          )}

          <div>
            <label className={labelCls}>To’liq ism familiya (pasportdagi kabi)</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masalan: Aliyev Valiyev Valiy"
              className={inputCls}
              autoComplete="name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tavallud sanasi</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>PINFL (14 raqam)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={14}
                value={pinfl}
                onChange={(e) => setPinfl(e.target.value.replace(/\D/g, '').slice(0, 14))}
                placeholder="12345678901234"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Pasport seriyasi</label>
              <input
                type="text"
                maxLength={4}
                value={series}
                onChange={(e) => setSeries(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="AA"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Pasport raqami</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="1234567"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                Kim tomonidan berilgan <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
              </label>
              <input
                type="text"
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                placeholder="O‘RB"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Berilgan sana <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
              </label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Rasm yuklash */}
          <div>
            <label className={labelCls}>Pasport yuzasi yoki selfie rasmi</label>
            {photoUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <img src={photoUrl} alt="Yuklangan hujjat" className="w-full max-h-56 object-contain" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="absolute top-2 right-2 h-8 px-3 rounded-lg bg-white/90 text-rose-600 text-xs font-bold shadow-sm active:bg-white"
                >
                  O‘chirish
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 w-full h-32 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500 cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-colors">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5" />
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold">Rasm tanlash yoki yuklash</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={isUploading} />
              </label>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Ma’lumotlar shifrlangan holda saqlanadi va faqat ma’muriyat ko’radi.</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="w-full h-12 rounded-xl bg-[#1673E6] hover:bg-[#0f5fbd] active:bg-[#0b52a3] text-white font-bold text-sm transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Yuborilmoqda...</span>
              </>
            ) : (
              <span>Arizani yuborish</span>
            )}
          </button>
        </form>
      )}
    </Modal>
  );
};

export default VerifyRequestModal;
