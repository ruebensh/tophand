import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';
import { Modal } from '../common/Modal.tsx';
import { useI18n } from '../../i18n/IntlContext.tsx';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'LISTING' | 'USER' | 'ORGANIZATION' | 'MESSAGE' | 'CONVERSATION';
  targetId: string;
  targetTitle?: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
}) => {
  const { t } = useI18n();
  const [reason, setReason] = useState('spam');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const REASONS = [
    { id: 'spam', label: t('report.spam') },
    { id: 'fraud', label: t('report.fraud') },
    { id: 'inappropriate_content', label: t('report.inappropriate') },
    { id: 'false_information', label: t('report.falseInfo') },
    { id: 'harassment', label: t('report.harassment') },
    { id: 'prohibited_service', label: t('report.prohibited') },
    { id: 'other', label: t('report.other') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await apiRequest('/api/moderation/reports', {
        method: 'POST',
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
          description: description.trim() || undefined,
        }),
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || t('report.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('report.title')}>
      {targetTitle && (
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 line-clamp-2">{targetTitle}</p>
        </div>
      )}

      {isSuccess ? (
        <div className="py-8 text-center text-emerald-600">
          <div className="text-3xl mb-2">✓</div>
          <p className="font-bold text-sm">{t('report.submitted')}</p>
          <p className="text-xs text-gray-500 mt-1">{t('report.submittedHint')}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              {t('report.reasonTitle')}
            </label>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    reason === r.id
                      ? 'bg-blue-50/60 border-blue-500 text-blue-900 font-semibold'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="report_reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="accent-blue-600"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t('report.noteLabel')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('report.notePh')}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[44px] px-5 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-[44px] px-6 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? t('common.sending') : t('common.submit')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
