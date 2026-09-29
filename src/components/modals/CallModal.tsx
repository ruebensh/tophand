import React from 'react';
import { X, Phone, ShieldAlert, MessageSquare } from 'lucide-react';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  ownerName: string;
  onOpenChat?: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
  phone,
  ownerName,
  onOpenChat,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
          <Phone className="w-6 h-6" />
        </div>

        <h3 className="font-bold text-base text-gray-900">{ownerName} bilan bog‘lanish</h3>
        <p className="text-xl font-extrabold text-blue-900 mt-2 tracking-wide font-mono">{phone}</p>

        {/* Safety Disclaimer (Section 71 & 8) */}
        <div className="mt-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-800 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 mb-0.5">Xavfsizlik eslatmasi</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Shaxsiy ma’lumotlaringiz va bank kartalaringizni ulashishdan oldin ehtiyot bo‘ling. Oldindan to‘lov qilmang. TopHand orqali yozish — tavsiya etilgan xavfsiz aloqa usuli.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <a
            href={`tel:${phone}`}
            className="w-full py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
          >
            <Phone className="w-4 h-4" />
            <span>Qo‘ng‘iroq qilish</span>
          </a>

          {onOpenChat && (
            <button
              onClick={() => {
                onClose();
                onOpenChat();
              }}
              className="w-full py-2 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>TopHand Chat orqali yozish (Xavfsiz)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
