import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n/IntlContext.tsx';

/**
 * TopHand shared Modal shell — modeled on Avito's modern (Gen B) dialog system.
 *
 * Design tokens (measured from avito.ru):
 *  - backdrop rgba(0,0,0,0.45), no blur
 *  - card radius 28px, white, shadow `0 4px 24px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.05)`
 *  - inner padding 36/40/44 on desktop
 *  - close button inside top-right, 36x36, rounded-full
 *  - mobile: bottom sheet (rounded top only, full width)
 *
 * Pass `footer` to render Avito's tinted full-bleed bottom section.
 */

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<ModalSize, string> = {
  sm: 'sm:max-w-[384px]',
  md: 'sm:max-w-[470px]',
  lg: 'sm:max-w-[640px]',
  xl: 'sm:max-w-[800px]',
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional title row rendered inside the header (string or node). */
  title?: React.ReactNode;
  /** Full custom, non-scrolling header slot. Overrides `title` + built-in close. */
  header?: React.ReactNode;
  children: React.ReactNode;
  /** Optional tinted, full-bleed footer section (Avito auth-modal style). */
  footer?: React.ReactNode;
  size?: ModalSize;
  /** Body padding override; default is Avito's roomy 36/40. */
  padded?: boolean;
  hideClose?: boolean;
  /** Extra classes on the card container. */
  className?: string;
  /** Close on backdrop click. Default true. */
  dismissable?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  header,
  children,
  footer,
  size = 'md',
  padded = true,
  hideClose = false,
  className = '',
  dismissable = true,
}) => {
  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/45 animate-[thFade_.18s_ease-out]"
      onClick={dismissable ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${sizeMap[size]} bg-white rounded-t-[28px] sm:rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.05)] max-h-[92vh] overflow-hidden flex flex-col animate-[thSheetUp_.22s_cubic-bezier(.22,1,.36,1)] sm:animate-[thPop_.18s_ease-out] ${className}`}
      >
        {/* Header: full custom slot wins, else default title + close */}
        {header ? (
          <div className="shrink-0">{header}</div>
        ) : title ? (
          <div className="shrink-0 px-6 sm:px-10 pt-6 sm:pt-9 pb-3 flex items-start justify-between gap-4">
            <h3 className="text-[22px] sm:text-[24px] font-bold leading-tight text-gray-950">{title}</h3>
            {!hideClose && <CloseButton onClose={onClose} />}
          </div>
        ) : null}

        {/* Body */}
        <div className={`flex-1 min-h-0 overflow-y-auto ${!header && !title ? 'pt-6 sm:pt-9' : ''} ${padded ? 'px-6 sm:px-10 pb-6 sm:pb-8' : ''}`}>
          {!header && !title && !hideClose && (
            <div className="flex justify-end mb-1">
              <CloseButton onClose={onClose} />
            </div>
          )}
          {children}
        </div>

        {/* Tinted full-bleed footer */}
        {footer && (
          <div className="shrink-0 bg-[#F2EFE9] rounded-b-[28px] px-6 sm:px-10 pt-6 sm:pt-7 pb-7 sm:pb-9">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes thFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes thPop { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } }
        @keyframes thSheetUp { from { transform: translateY(16px); opacity: .6 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>,
    document.body
  );
};

const CloseButton: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useI18n();
  return (
  <button
    type="button"
    onClick={onClose}
    aria-label={t('common.close')}
    className="shrink-0 w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
  >
    <X className="w-[18px] h-[18px]" strokeWidth={2.2} />
  </button>
  );
};

export default Modal;
