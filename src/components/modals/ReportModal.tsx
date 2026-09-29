import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';

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
  const [reason, setReason] = useState('spam');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const REASONS = [
    { id: 'spam', label: 'Spam yoki takroriy e’lon' },
    { id: 'fraud', label: 'Firibgarlik yoki shubhali faoliyat' },
    { id: 'inappropriate_content', label: 'Nomaqbul yoki behayo kontent' },
    { id: 'false_information', label: 'Yolg‘on ma’lumot yoki narx' },
    { id: 'harassment', label: 'Haqorat, tahdid yoki bezorilik' },
    { id: 'prohibited_service', label: 'Qonunga zid yoki taqiqlangan xizmat' },
    { id: 'other', label: 'Boshqa sabab' },
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
      setError(err.message || 'Shikoyat yuborishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-gray-900">Shikoyat yuborish</h3>
            {targetTitle && <p className="text-xs text-gray-500 line-clamp-1">{targetTitle}</p>}
          </div>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center text-emerald-600">
            <div className="text-3xl mb-2">✓</div>
            <p className="font-bold text-sm">Shikoyatingiz qabul qilindi</p>
            <p className="text-xs text-gray-500 mt-1">Moderatorlar tez orada ko‘rib chiqadilar.</p>
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
                Shikoyat sababini tanlang:
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
                Qo‘shimcha izoh (ixtiyoriy):
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vaziyatni qisqacha tushuntirib bering..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-colors"
              >
                {isSubmitting ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
