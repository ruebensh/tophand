import React from 'react';
import { Phone, ShieldAlert, MessageSquare } from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { useI18n } from '../../i18n/IntlContext.tsx';

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
  const { t } = useI18n();
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={t('detail.callTitle', { name: ownerName })}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
          <Phone className="w-6 h-6" />
        </div>
        <p className="text-2xl font-extrabold text-gray-950 tracking-wide font-mono">{phone}</p>
      </div>

      {/* Safety disclaimer (Section 71 & 8) */}
      <div className="mt-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-800 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-900 mb-0.5">{t('detail.safetyTitle')}</p>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            {t('detail.safetyBody')}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <a
          href={`tel:${phone}`}
          className="w-full h-[52px] rounded-2xl bg-accent hover:bg-accent-dark text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <Phone className="w-[18px] h-[18px]" />
          <span>{t('detail.callNow')}</span>
        </a>

        {onOpenChat && (
          <button
            onClick={() => {
              onClose();
              onOpenChat();
            }}
            className="w-full h-[52px] rounded-2xl border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-[18px] h-[18px] text-blue-600" />
            <span>{t('detail.chatSafeBtn')}</span>
          </button>
        )}
      </div>
    </Modal>
  );
};

export default CallModal;
