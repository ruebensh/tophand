import React from 'react';
import { Layers } from 'lucide-react';
import * as Lucide from 'lucide-react';

/**
 * Resolve a lucide icon component by its PascalCase name (as stored in the
 * `categories.icon` / `catalogs.icon` seed data). Falls back to `Layers` when
 * the name is unknown, so a typo in seed data never crashes the UI.
 */
function resolveIcon(name?: string): React.ElementType {
  if (!name) return Layers;
  const mod = Lucide as unknown as Record<string, React.ElementType | undefined>;
  return mod[name] || mod[`${name}Icon`] || Layers;
}

interface CategoryIconProps {
  name?: string;
  className?: string;
  size?: number;
}

/** Plain monochrome icon (legacy usage). */
export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name = 'Layers',
  className = 'w-4 h-4',
  size,
}) => {
  const IconComponent = resolveIcon(name);
  return <IconComponent className={className} size={size} />;
};

// ─── Colored chip ──────────────────────────────────────────────────────
// Avitoning katalog ikonchalari kabi — pastel tinted fon + rangli ikon.
// Tone statik (Tailwind klasslari kod ichida to'liq yozilgan — purgega tushmaydi).
const TONES = [
  'bg-blue-50 text-blue-600',
  'bg-emerald-50 text-emerald-600',
  'bg-amber-50 text-amber-600',
  'bg-rose-50 text-rose-600',
  'bg-violet-50 text-violet-600',
  'bg-cyan-50 text-cyan-600',
  'bg-teal-50 text-teal-600',
  'bg-orange-50 text-orange-600',
  'bg-fuchsia-50 text-fuchsia-600',
  'bg-indigo-50 text-indigo-600',
  'bg-sky-50 text-sky-600',
  'bg-lime-600/10 text-lime-600',
] as const;

// Explicit tone → class (kataloglar uchun barqaror rang berishga imkon).
const EXPLICIT_TONES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  yellow: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  red: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600',
  purple: 'bg-violet-50 text-violet-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  teal: 'bg-teal-50 text-teal-600',
  orange: 'bg-orange-50 text-orange-600',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  sky: 'bg-sky-50 text-sky-600',
  lime: 'bg-lime-600/10 text-lime-600',
};

const SIZES = {
  sm: { box: 'w-8 h-8 rounded-lg', icon: 15 },
  md: { box: 'w-10 h-10 rounded-xl', icon: 19 },
  lg: { box: 'w-12 h-12 rounded-xl', icon: 23 },
  xl: { box: 'w-14 h-14 rounded-2xl', icon: 27 },
} as const;

type ChipSize = keyof typeof SIZES;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

interface CategoryChipProps {
  name?: string;
  size?: ChipSize;
  /** Color family name (blue/emerald/…) yoki undefined — name bo'yicha barqaror tanlanadi. */
  tone?: string;
  className?: string;
  /** Ikon ichidagi konteyner, masalan uy ichida qo'shimcha border/radius. */
  rounded?: string;
}

/** Rangli, yumshoq tinted ikonachi (katalog/kategoriya uchun). */
export const CategoryChip: React.FC<CategoryChipProps> = ({
  name = 'Layers',
  size = 'md',
  tone,
  className = '',
  rounded,
}) => {
  const IconComponent = resolveIcon(name);
  const toneClass =
    (tone && EXPLICIT_TONES[tone]) || TONES[hashString(name) % TONES.length];
  const s = SIZES[size];
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${s.box} ${
        rounded || ''
      } ${toneClass} ${className}`}
    >
      <IconComponent size={s.icon} strokeWidth={2} />
    </span>
  );
};

export default CategoryIcon;
