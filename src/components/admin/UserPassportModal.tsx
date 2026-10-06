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
import { useI18n } from '../../i18n/IntlContext.tsx';

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

  const { t } = useI18n();

  if (!isOpen || !user) return null;

  const handleCopyIIVProtocol = () => {
    const none = t('admin.upmNotAvailable');
    const text = `
${t('admin.upmProtoTitle')}
-------------------------------------------------------------------------
${t('admin.upmProtoPlatformLine')}
${t('admin.upmProtoUserId')} ${user.id}
${t('admin.upmProtoTelegramId')} ${user.telegram_id || none}
${t('admin.upmProtoTelegramUser')} ${user.telegram_username ? '@' + user.telegram_username : none}
${t('admin.upmProtoPhone')} ${user.phone || t('admin.passportNot')}

${t('admin.upmProtoDocHeader')}
${t('admin.upmProtoFullName')} ${user.full_legal_name || user.name}
${t('admin.upmProtoPinfl')} ${user.pinfl || none}
${t('admin.upmProtoSeriesNum')} ${(user.passport_series || '') + ' ' + (user.passport_number || none)}
${t('admin.upmProtoBirth')} ${user.birth_date || none}
${t('admin.upmProtoIssuedBy')} ${user.passport_issued_by || none}
${t('admin.upmProtoIssuedDate')} ${user.passport_issued_date || none}

${t('admin.upmProtoPlatformState')}
${t('admin.upmProtoBadge')} ${user.verification_status || 'UNVERIFIED'}
${t('admin.upmProtoVerifiedAt')} ${user.verified_at || none}
${t('admin.upmProtoRegistered')} ${user.created_at}
${t('admin.upmProtoRegion')} ${user.district_name || ''}, ${user.region_name || ''}
-------------------------------------------------------------------------
${t('admin.upmProtoFooter')}
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
      alert(err.message || t('common.errGeneric'));
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
      alert(err.message || t('admin.upmSavePassportErr'));
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
                {user.telegram_username ? `@${user.telegram_username}` : t('admin.upmNoUsername')} • ID: {user.id}
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
                  {t('admin.upmVerStatus')}{' '}
                  {user.verification_status === 'VERIFIED'
                    ? t('admin.upmVerRasmiy')
                    : user.verification_status === 'PENDING'
                    ? t('admin.upmVerPending')
                    : t('admin.upmVerUnverified')}
                </span>
              </div>
              {user.verified_at && (
                <p className="text-xs opacity-75 mt-0.5">
                  {t('admin.upmVerifiedDate')} {formatDateAgo(user.verified_at)}
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
                  {t('admin.upmGiveBadge')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleUpdateVerification('UNVERIFIED')}
                  className="px-4 py-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs cursor-pointer"
                >
                  {t('admin.upmRevokeBadge')}
                </button>
              )}
              {user.verification_status === 'PENDING' && (
                <button
                  type="button"
                  onClick={() => setShowRejectInput(!showRejectInput)}
                  className="px-3.5 py-2 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs cursor-pointer"
                >
                  {t('admin.upmReject')}
                </button>
              )}
            </div>
          </div>

          {/* Rejection input if triggered */}
          {showRejectInput && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
              <label className="text-xs font-bold text-rose-900 block">
                {t('admin.upmRejectReasonLabel')}
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('admin.upmRejectReasonPh')}
                className="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-xs text-gray-900 focus:outline-hidden"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleUpdateVerification('REJECTED')}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs cursor-pointer"
                >
                  {t('admin.upmConfirmReject')}
                </button>
              </div>
            </div>
          )}

          {/* Legal Warning Notice */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{t('admin.upmLegalTitle')}</span>
            </span>
            <p className="opacity-90 leading-relaxed">
              {t('admin.upmLegalBody')}
            </p>
          </div>

          {/* Passport & Legal Data Form / Display */}
          <div className="bg-gray-50/80 rounded-2xl border border-gray-200/70 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>{t('admin.upmPassportSectionTitle')}</span>
              </h4>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyIIVProtocol}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title={t('admin.upmCopyProtoTip')}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? t('admin.upmCopied') : t('admin.upmCopyProto')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingPassport(!isEditingPassport)}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 cursor-pointer"
                  title={t('common.edit')}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isEditingPassport ? (
              <form onSubmit={handleSavePassportData} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">{t('admin.upmFlsxLabel')}</label>
                    <input
                      type="text"
                      value={fullLegalName}
                      onChange={(e) => setFullLegalName(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold"
                      placeholder={t('admin.upmFlsxPh')}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">{t('admin.upmPinflLabel')}</label>
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
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">{t('admin.upmSeriesLabel')}</label>
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
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">{t('admin.upmNumberLabel')}</label>
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
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">{t('admin.upmBirthLabel')}</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">{t('admin.upmIssuedByLabel')}</label>
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
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{t('common.save')}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">{t('admin.upmFullLegalLabel')}</span>
                  <span className="font-bold text-gray-900">{user.full_legal_name || user.name || t('admin.passportNot')}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">{t('admin.upmPinflViewLabel')}</span>
                  <span className="font-bold font-mono text-gray-900">{user.pinfl || t('admin.passportNot')}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">{t('admin.upmSeriesViewLabel')}</span>
                  <span className="font-bold font-mono text-gray-900">
                    {user.passport_series ? `${user.passport_series} ${user.passport_number}` : t('admin.passportNot')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">{t('admin.upmBirthViewLabel')}</span>
                  <span className="font-semibold text-gray-800">{user.birth_date || t('admin.passportNot')}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-400 block mb-0.5">{t('admin.upmIssuedViewLabel')}</span>
                  <span className="font-semibold text-gray-800">
                    {user.passport_issued_by ? `${user.passport_issued_by} (${user.passport_issued_date || ''})` : t('admin.passportNot')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* User Contact & Platform Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-white border border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 block">{t('admin.upmPhoneLabel')}</span>
              <span className="font-bold text-gray-900">{user.phone || t('admin.passportNot')}</span>
            </div>
            <div>
              <span className="text-gray-400 block">{t('admin.upmRegionLabel')}</span>
              <span className="font-bold text-gray-900">{user.district_name ? `${user.district_name}, ` : ''}{user.region_name || t('admin.upmUzbekistan')}</span>
            </div>
            <div>
              <span className="text-gray-400 block">{t('admin.upmRoleLabel')}</span>
              <span className="font-bold text-blue-600">{user.role}</span>
            </div>
            <div>
              <span className="text-gray-400 block">{t('admin.upmListingsLabel')}</span>
              <span className="font-bold text-gray-900">{t('common.count', { n: user.listings_count || 0 })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
