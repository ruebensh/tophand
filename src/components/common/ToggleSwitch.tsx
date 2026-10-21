// ============================================================================
//  ToggleSwitch — glassmorphism (frost-glass + glossy) silliq almashinuv tugmasi.
// ----------------------------------------------------------------------------
//  Dizayn tili: sovuq ko'k + oq palitra, mat-shisha track, yaltiroq (glossy) knob,
//  nozik diffuz yorug'lik va chuqurlik. Animatsiya: knob spring (overshoot) bilan
//  siljiydi, bosilganda "squish" (cho'zilish) effekti. prefers-reduced-motion
//  hurmat qilinadi. A11y: role="switch" + aria-checked + klaviatura (Enter/Space).
//  Bog'liqliksiz (faqat React + CSS), MobileNav'dagi kabi scoped <style>.
// ============================================================================

import React from 'react';

type Size = 'sm' | 'md' | 'lg';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  size?: Size;
  /** Ekran o'quvchilar uchun nom (ko'rinadigan label bo'lmasa). */
  ariaLabel?: string;
  className?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  ariaLabel,
  className = '',
}) => {
  const toggle = () => {
    if (!disabled) onChange(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={toggle}
      className={`th-toggle th-toggle--${size} ${checked ? 'is-on' : ''} ${className}`}
    >
      <span className="th-toggle__knob" aria-hidden />
    </button>
  );
};

// Komponent bir necha marta import qilinsa ham, <style> bir marta kiritiladi.
const STYLE_ID = 'th-toggle-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .th-toggle {
      --pad: 3px;
      position: relative;
      display: inline-flex;
      align-items: center;
      flex: none;
      width: var(--tw);
      height: var(--th);
      border-radius: 9999px;
      padding: 0;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      background: linear-gradient(180deg, rgba(224, 234, 248, 0.95) 0%, rgba(255, 255, 255, 0.72) 100%);
      border: 1px solid rgba(255, 255, 255, 0.85);
      box-shadow:
        inset 0 1px 3px rgba(37, 99, 235, 0.16),
        inset 0 -1px 1px rgba(255, 255, 255, 0.9),
        0 1px 2px rgba(15, 23, 42, 0.06);
      backdrop-filter: blur(8px) saturate(140%);
      -webkit-backdrop-filter: blur(8px) saturate(140%);
      transition: background .35s ease, box-shadow .35s ease, border-color .35s ease;
    }

    /* Oq rangdagi glossy yuqori shine (shisha) qatlami */
    .th-toggle::before {
      content: '';
      position: absolute;
      inset: 1px;
      border-radius: 9999px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 52%);
      pointer-events: none;
      z-index: 1;
    }

    /* YOQILGAN (on) holat — sovuq ko'k to'ldirilgan shisha + yumshoq nur */
    .th-toggle.is-on {
      background: linear-gradient(135deg, #6FB0F5 0%, #2E82E8 50%, #1673E6 100%);
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow:
        inset 0 1px 1px rgba(255, 255, 255, 0.55),
        0 6px 16px -4px rgba(22, 115, 230, 0.45),
        0 0 20px rgba(111, 176, 245, 0.35);
    }

    /* Knob — oq glossy shar; siljish spring (overshoot) egri chizig'i bilan */
    .th-toggle__knob {
      position: absolute;
      top: 50%;
      left: 0;
      width: var(--knob);
      height: var(--knob);
      border-radius: 9999px;
      background: linear-gradient(180deg, #ffffff 0%, #eaf2fe 100%);
      box-shadow:
        0 2px 6px rgba(15, 23, 42, 0.28),
        0 0 0 1px rgba(37, 99, 235, 0.06),
        inset 0 1px 1px rgba(255, 255, 255, 0.95);
      transform: translate(var(--kx), -50%);
      transform-origin: left center;
      transition: transform .34s cubic-bezier(.34, 1.56, .64, 1), box-shadow .3s ease;
      will-change: transform;
      z-index: 2;
    }

    .th-toggle.is-on .th-toggle__knob {
      --kx: calc(var(--tw) - var(--knob) - var(--pad));
      transform-origin: right center;
    }

    /* Bosilganda nozik "squish" (devorga qarab cho'zilish) — tactile his */
    .th-toggle:active .th-toggle__knob {
      transform: translate(var(--kx), -50%) scaleX(1.16);
    }

    .th-toggle:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    .th-toggle:focus-visible {
      outline: none;
      box-shadow:
        0 0 0 3px rgba(111, 176, 245, 0.5),
        inset 0 1px 3px rgba(37, 99, 235, 0.16);
    }

    /* O'lchamlar */
    .th-toggle--sm { --tw: 38px; --th: 22px; --knob: 16px; --kx: var(--pad); }
    .th-toggle--md { --tw: 48px; --th: 28px; --knob: 22px; --kx: var(--pad); }
    .th-toggle--lg { --tw: 56px; --th: 32px; --knob: 26px; --kx: var(--pad); }

    @media (prefers-reduced-motion: reduce) {
      .th-toggle, .th-toggle__knob { transition: none; }
      .th-toggle:active .th-toggle__knob { transform: translate(var(--kx), -50%); }
    }
  `;
  document.head.appendChild(style);
}

export default ToggleSwitch;
