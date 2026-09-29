import React, { useState } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { VerifiedBadge } from '../common/VerifiedBadge.tsx';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  FileText,
  User,
  Calendar,
  MapPin,
  Ban,
  Clock,
  ExternalLink,
  Edit2,
  Save,
} from 'lucide-react';
import { formatDateAgo } from '../../lib/utils.ts';

interface UserPassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUserUpdated: () => void;
}

export const UserPassportModal: React.FC<UserPassportModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
}) => {
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Edit passport fields state
  const [isEditingPassport, setIsEditingPassport] = useState(false);
  const [pinfl, setPinfl] = useState(user?.pinfl || '');
  const [passportSeries, setPassportSeries] = useState(user?.passport_series || '');
  const [passportNumber, setPassportNumber] = useState(user?.passport_number || '');
  const [fullLegalName, setFullLegalName] = useState(user?.full_legal_name || '');
  const [birthDate, setBirthDate] = useState(user?.birth_date || '');
  const [passportIssuedBy, setPassportIssuedBy] = useState(user?.passport_issued_by || '');
  const [passportIssuedDate, setPassportIssuedDate] = useState(user?.passport_issued_date || '');

  if (!isOpen || !user) return null;

  const handleCopyIIVProtocol = () => {
    const text = `
O'ZBEKISTON RESPUBLIKASI ICHKI ISHLAR VAZIRLIGI (IIV) SURISHTIRUV PROTOKOLI
-------------------------------------------------------------------------
Platforma: TopHand.uz (Elektron xizmatlar va bandlik portali)
Foydalanuvchi ID: ${user.id}
Telegram ID: ${user.telegram_id || 'Mavjud emas'}
Telegram username: ${user.telegram_username ? '@' + user.telegram_username : 'Mavjud emas'}
Telefon: ${user.phone || 'Kiritilmagan'}

SHAXSNI TASDIQLOVCHI HUJJAT MA'LUMOTLARI:
To'liq F.I.SH: ${user.full_legal_name || user.name}
JSHSHIR (PINFL): ${user.pinfl || 'Mavjud emas'}
Pasport seriya va raqam: ${(user.passport_series || '') + ' ' + (user.passport_number || 'Mavjud emas')}
Tug'ilgan sana: ${user.birth_date || 'Mavjud emas'}
Kim tomonidan berilgan: ${user.passport_issued_by || 'Mavjud emas'}
Berilgan sana: ${user.passport_issued_date || 'Mavjud emas'}

PLATFORMA HOLATI:
Tasdiq nishoni: ${user.verification_status || 'UNVERIFIED'}
Tasdiqlangan vaqt: ${user.verified_at || 'Mavjud emas'}
Ro'yxatdan o'tgan: ${user.created_at}
Hudud: ${user.district_name || ''}, ${user.region_name || ''}
-------------------------------------------------------------------------
Ma'lumotlar platforma ma'muriyati server bazasidan olingan.
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleUpdateVerification = async (status: 'VERIFIED' | 'REJECTED' | 'UNVERIFIED') => {
    setIsProcessing(true);
    try {
      await apiRequest(`/api/admin/users/${user.id}/verification`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          rejection_reason: status === 'REJECTED' ? rejectReason : undefined,
        }),
      });
      onUserUpdated();
      setShowRejectInput(false);
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSavePassportData = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await apiRequest(`/api/admin/users/${user.id}/passport`, {
        method: 'PUT',
        body: JSON.stringify({
          pinfl,
          passport_series: passportSeries,
          passport_number: passportNumber,
          full_legal_name: fullLegalName,
          birth_date: birthDate,
          passport_issued_by: passportIssuedBy,
          passport_issued_date: passportIssuedDate,
        }),
      });
      setIsEditingPassport(false);
      onUserUpdated();
    } catch (err: any) {
      alert(err.message || 'Pasport ma’lumotlarini saqlashda xatolik');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <img
              src={user.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
              alt={user.name}
              className="w-12 h-12 rounded-2xl object-cover ring-2 ring-gray-100"
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-base text-gray-950">{user.name}</h3>
                {user.verification_status === 'VERIFIED' && <VerifiedBadge size="sm" />}
              </div>
              <p className="text-xs text-gray-400">
                {user.telegram_username ? `@${user.telegram_username}` : 'Username yo‘q'} • ID: {user.id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Official Verification Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              user.verification_status === 'VERIFIED'
                ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                : user.verification_status === 'PENDING'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-gray-50 border-gray-200 text-gray-800'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                {user.verification_status === 'VERIFIED' ? (
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                )}
                <span className="font-bold text-sm">
                  Tasdiq holati:{' '}
                  {user.verification_status === 'VERIFIED'
                    ? 'Rasmiy tasdiqlangan (Verified)'
                    : user.verification_status === 'PENDING'
                    ? 'Ariza topshirilgan (Tekshirish kutilmoqda)'
                    : 'Tasdiqlanmagan'}
                </span>
              </div>
              {user.verified_at && (
                <p className="text-xs opacity-75 mt-0.5">
                  Tasdiqlangan sana: {formatDateAgo(user.verified_at)}
                </p>
              )}
            </div>

            {/* Quick Action Buttons for Verification */}
            <div className="flex items-center gap-2">
              {user.verification_status !== 'VERIFIED' ? (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleUpdateVerification('VERIFIED')}
                  className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Tasdiq nishonini berish
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleUpdateVerification('UNVERIFIED')}
                  className="px-4 py-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs cursor-pointer"
                >
                  Nishonni bekor qilish
                </button>
              )}
              {user.verification_status === 'PENDING' && (
                <button
                  type="button"
                  onClick={() => setShowRejectInput(!showRejectInput)}
                  className="px-3.5 py-2 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs cursor-pointer"
                >
                  Rad etish
                </button>
              )}
            </div>
          </div>

          {/* Rejection input if triggered */}
          {showRejectInput && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
              <label className="text-xs font-bold text-rose-900 block">
                Rad etish sababini kiriting (foydalanuvchiga xabar yuboriladi):
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Masalan: Pasport fotosurati xira yoki JSHSHIR mos kelmadi..."
                className="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-xs text-gray-900 focus:outline-hidden"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleUpdateVerification('REJECTED')}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs cursor-pointer"
                >
                  Rad etishni tasdiqlash
                </button>
              </div>
            </div>
          )}

          {/* Legal Warning Notice */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>IIV tergov organlari va Huquqiy xavfsizlik kafolati:</span>
            </span>
            <p className="opacity-90 leading-relaxed">
              Ushbu pasport ma’lumotlari foydalanuvchi tomonidan tasdiq nishoni olish arizasida kiritilgan. Tasdiqlangan mutaxassis tomonidan firibgarlik yoki huquqbuzarlik sodir etilganda, ushbu ma’lumotlar IIV xodimlariga taqdim etiladi.
            </p>
          </div>

          {/* Passport & Legal Data Form / Display */}
          <div className="bg-gray-50/80 rounded-2xl border border-gray-200/70 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Pasport va Shaxsiy Identifikatsiya (JSHSHIR)</span>
              </h4>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyIIVProtocol}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="IIVga taqdim etish uchun protokol matnidan nusxa olish"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Nusxalandi!' : 'IIV protokolidan nusxa'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingPassport(!isEditingPassport)}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 cursor-pointer"
                  title="Tahrirlash"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isEditingPassport ? (
              <form onSubmit={handleSavePassportData} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">F.I.SH (Pasport bo‘yicha)</label>
                    <input
                      type="text"
                      value={fullLegalName}
                      onChange={(e) => setFullLegalName(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold"
                      placeholder="Masalan: Otajonov Javohir Baxtiyorovich"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">JSHSHIR (PINFL - 14 ta raqam)</label>
                    <input
                      type="text"
                      value={pinfl}
                      onChange={(e) => setPinfl(e.target.value)}
                      maxLength={14}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold"
                      placeholder="31205901234567"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Pasport Seriya</label>
                    <input
                      type="text"
                      value={passportSeries}
                      onChange={(e) => setPassportSeries(e.target.value.toUpperCase())}
                      maxLength={2}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold"
                      placeholder="AA"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Pasport Raqam</label>
                    <input
                      type="text"
                      value={passportNumber}
                      onChange={(e) => setPassportNumber(e.target.value)}
                      maxLength={7}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold"
                      placeholder="1234567"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Tug‘ilgan sana</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Kim tomonidan berilgan</label>
                    <input
                      type="text"
                      value={passportIssuedBy}
                      onChange={(e) => setPassportIssuedBy(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs"
                      placeholder="Chilonzor tumani IIB FMB"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingPassport(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Saqlash</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">To‘liq qonuniy F.I.SH:</span>
                  <span className="font-bold text-gray-900">{user.full_legal_name || user.name || 'Kiritilmagan'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">JSHSHIR (PINFL):</span>
                  <span className="font-bold font-mono text-gray-900">{user.pinfl || 'Kiritilmagan'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Pasport Seriya va Raqami:</span>
                  <span className="font-bold font-mono text-gray-900">
                    {user.passport_series ? `${user.passport_series} ${user.passport_number}` : 'Kiritilmagan'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Tug‘ilgan sanasi:</span>
                  <span className="font-semibold text-gray-800">{user.birth_date || 'Kiritilmagan'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-400 block mb-0.5">Berilgan joyi va sanasi:</span>
                  <span className="font-semibold text-gray-800">
                    {user.passport_issued_by ? `${user.passport_issued_by} (${user.passport_issued_date || ''})` : 'Kiritilmagan'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* User Contact & Platform Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-white border border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 block">Telefon raqami:</span>
              <span className="font-bold text-gray-900">{user.phone || 'Kiritilmagan'}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Hududi:</span>
              <span className="font-bold text-gray-900">{user.district_name ? `${user.district_name}, ` : ''}{user.region_name || 'O‘zbekiston'}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Platformadagi roli:</span>
              <span className="font-bold text-blue-600">{user.role}</span>
            </div>
            <div>
              <span className="text-gray-400 block">E’lonlar soni:</span>
              <span className="font-bold text-gray-900">{user.listings_count || 0} ta</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
