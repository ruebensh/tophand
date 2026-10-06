// ============================================================================
//  Translated — foydalanuvchi kontentini joriy tilda ko'rsatadi (ru/en MT,
//  uz-Cyrl translit, uz asl). Yuklanayotganda asl matn pasaytirilgan holda
//  turadi (layout siljimaydi).
// ============================================================================

import React from 'react';
import { useTranslate } from '../../i18n/useTranslate.ts';

interface TranslatedProps {
  text: string | null | undefined;
  className?: string;
  /** MT ni o'chirish (masalan, tahrirlash maydonlarida asl matn kerak). */
  enabled?: boolean;
  /** Qatorlar o'rnini bosuvchi element (default: <span>). */
  as?: React.ElementType;
}

export const Translated: React.FC<TranslatedProps> = ({
  text,
  className,
  enabled = true,
  as: Tag = 'span',
}) => {
  const { value, loading } = useTranslate(text, enabled);
  return (
    <Tag className={className} style={loading ? { opacity: 0.75 } : undefined}>
      {value}
    </Tag>
  );
};

export default Translated;
