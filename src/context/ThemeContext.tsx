import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '../lib/api.ts';
import { useGeo } from './GeoContext.tsx';
import {
  DEFAULT_THEME,
  REGION_THEMES,
  mergeRegionThemes,
  type RegionTheme,
} from '../lib/regionThemes.ts';
import { DEFAULT_HOLIDAYS, computeActiveHoliday, type HolidayDef } from '../lib/holidays.ts';
import {
  getCardPattern,
  getAtmosphereOrnament,
  type PatternKey,
  type EffectKey,
} from '../lib/themePatterns.ts';

export type ThemeKind = 'default' | 'region' | 'holiday';

export interface ActiveTheme {
  kind: ThemeKind;
  id: string;
  accent: string;
  accentSoft: string;
  gradient: string;
  motif: string;
  badge: string;
  heroImageUrl?: string;
  holidayName?: string;
  backgrounds: string[];
  pattern: PatternKey;
  effect: EffectKey;
}

interface ThemeOverride {
  type: 'holiday' | 'region' | 'none';
  id?: string;
}

interface ThemeContextType {
  theme: ActiveTheme;
  holidays: HolidayDef[];
  regionThemes: Record<string, RegionTheme>;
  /** Admin panel: hudud (GPS) dizayni yoqilgan/o'chirilgan */
  regionThemesEnabled: boolean;
  /** Admin panel uchun local preview (serverga yozmaydi) */
  preview: ThemeOverride | null;
  setPreview: (p: ThemeOverride | null) => void;
  reload: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: { ...DEFAULT_THEME, kind: 'default', id: 'default' } as ActiveTheme,
  holidays: DEFAULT_HOLIDAYS,
  regionThemes: REGION_THEMES,
  regionThemesEnabled: true,
  preview: null,
  setPreview: () => {},
  reload: async () => {},
});

function regionBackgrounds(rt: RegionTheme): string[] {
  const list = Array.isArray(rt.backgrounds) ? [...rt.backgrounds] : [];
  if (!list.length && rt.hero_image_url) list.push(rt.hero_image_url);
  return list.filter(Boolean);
}

function resolveTheme(
  regionId: string | null,
  holidays: HolidayDef[],
  regionThemes: Record<string, RegionTheme>,
  override: ThemeOverride | null,
  regionThemesEnabled: boolean
): ActiveTheme {
  // Admin/override (preview yoki server theme_override) ustun
  if (override && override.type !== 'none' && override.id) {
    if (override.type === 'holiday') {
      const h = holidays.find((x) => x.id === override.id);
      if (h) {
        return {
          kind: 'holiday', id: h.id, accent: h.accent, accentSoft: h.accentSoft,
          gradient: h.gradient, motif: h.motif, badge: h.name, holidayName: h.name,
          backgrounds: h.backgrounds || [], pattern: 'plain', effect: h.effect || 'sparkle',
        };
      }
    }
    if (override.type === 'region' && regionThemesEnabled) {
      const rt = regionThemes[override.id];
      if (rt) {
        return {
          kind: 'region', id: override.id, accent: rt.accent, accentSoft: rt.accentSoft,
          gradient: rt.gradient, motif: rt.motif, badge: rt.badge, heroImageUrl: rt.hero_image_url,
          backgrounds: regionBackgrounds(rt), pattern: rt.pattern || 'plain', effect: 'none',
        };
      }
    }
  }

  // Bayram oynasi (3 kun oldin/so'ng) — hamma uchun
  const active = computeActiveHoliday(holidays);
  if (active) {
    return {
      kind: 'holiday', id: active.id, accent: active.accent, accentSoft: active.accentSoft,
      gradient: active.gradient, motif: active.motif, badge: active.name, holidayName: active.name,
      backgrounds: active.backgrounds || [], pattern: 'plain', effect: active.effect || 'sparkle',
    };
  }

  // Hudud mavzusi (admin o'chirgan bo'lsa qo'llanilmaydi)
  if (regionThemesEnabled && regionId && regionThemes[regionId]) {
    const rt = regionThemes[regionId];
    return {
      kind: 'region', id: regionId, accent: rt.accent, accentSoft: rt.accentSoft,
      gradient: rt.gradient, motif: rt.motif, badge: rt.badge, heroImageUrl: rt.hero_image_url,
      backgrounds: regionBackgrounds(rt), pattern: rt.pattern || 'plain', effect: 'none',
    };
  }

  // Standart
  return {
    ...DEFAULT_THEME, kind: 'default', id: 'default',
    backgrounds: [], pattern: 'plain', effect: 'none',
  };
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { region } = useGeo();
  const [holidays, setHolidays] = useState<HolidayDef[]>(DEFAULT_HOLIDAYS);
  const [regionThemes, setRegionThemes] = useState<Record<string, RegionTheme>>(REGION_THEMES);
  const [serverOverride, setServerOverride] = useState<ThemeOverride | null>(null);
  const [regionThemesEnabled, setRegionThemesEnabled] = useState(true);
  const [preview, setPreview] = useState<ThemeOverride | null>(null);

  const reload = useCallback(async () => {
    try {
      const cfg = await apiRequest<{
        holidays?: HolidayDef[];
        regionThemes?: Record<string, Partial<RegionTheme>>;
        override?: ThemeOverride | null;
        regionThemesEnabled?: boolean;
      }>('/api/theme/config');
      if (Array.isArray(cfg.holidays) && cfg.holidays.length) setHolidays(cfg.holidays);
      if (cfg.regionThemes) setRegionThemes(mergeRegionThemes(REGION_THEMES, cfg.regionThemes));
      setServerOverride(cfg.override && cfg.override.type ? cfg.override : null);
      if (typeof cfg.regionThemesEnabled === 'boolean') setRegionThemesEnabled(cfg.regionThemesEnabled);
    } catch {
      /* defaults remain */
    }
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 5 * 60 * 1000); // bayram/override o'zgarishini davriy tekshirish
    return () => clearInterval(t);
  }, [reload]);

  const theme = useMemo(
    () => resolveTheme(region?.region_id ?? null, holidays, regionThemes, preview ?? serverOverride, regionThemesEnabled),
    [region?.region_id, holidays, regionThemes, preview, serverOverride, regionThemesEnabled]
  );

  // CSS custom-property'larini va data-attribute'larni qo'llash
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--th-accent', theme.accent);
    root.style.setProperty('--th-accent-soft', theme.accentSoft);
    root.style.setProperty('--th-gradient', theme.gradient);
    root.style.setProperty('--th-card-pattern', getCardPattern(theme.pattern, theme.accent));
    root.style.setProperty('--th-atmo-ornament', getAtmosphereOrnament(theme.pattern, theme.accent));
    root.style.setProperty('--th-bg-image', theme.backgrounds[0] ? `url("${theme.backgrounds[0]}")` : 'none');
    document.body.setAttribute('data-theme-kind', theme.kind);
    document.body.setAttribute('data-theme-id', theme.id);
    document.body.setAttribute('data-effect', theme.effect);
  }, [theme]);

  const value: ThemeContextType = {
    theme, holidays, regionThemes, regionThemesEnabled, preview, setPreview, reload,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
