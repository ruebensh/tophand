// ============================================================================
//  LocationStep — WIZARD Step 3 (Lokatsiya).
//  Viloyat va tuman ustida qidiruvli combobox (matn kiritish → filtr), GPS
//  tugma (navigator.geolocation + /api/locations/detect). regionId/districtId/
//  latitude/longitude RHF omboriga yoziladi. Tashqi geocoder ishlatilmaydi.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { MapPin, Navigation, Check } from 'lucide-react';
import type { WizardFormValues } from '../../types/wizard.ts';
import { useWizardController } from './wizardContext.tsx';
import { INPUT_CLS, FieldError } from './fields.tsx';

interface ComboOption { id: string; label: string; }

// Qidiruvli combobox: yozilganda ro'yxat filtrlanadi, tanlash id ni qaytaradi.
const SearchCombobox: React.FC<{
  value: string;
  options: ComboOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}> = ({ value, options, placeholder, disabled, onChange }) => {
  const { t } = useWizardController();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.id === value)?.label || '';

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          value={open ? query : selectedLabel}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
          className={`${INPUT_CLS} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        {selectedLabel && !open && <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2" />}
      </div>
      {open && !disabled && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-gray-400">{t('wizard.locNoResult')}</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id); setOpen(false); setQuery(''); }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 cursor-pointer"
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const LocationStep: React.FC = () => {
  const ctl = useWizardController();
  const { t, localized, regions, districts } = ctl;
  const { control, watch, formState: { errors } } = useFormContext<WizardFormValues>();

  const regionId = watch('regionId');
  const latitude = watch('latitude');
  const longitude = watch('longitude');

  const regionOptions: ComboOption[] = regions.map((r) => ({ id: r.id, label: localized(r) }));
  const districtOptions: ComboOption[] = districts.map((d) => ({ id: d.id, label: localized(d) }));

  return (
    <div className="space-y-5">
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-lg font-black text-gray-900">{t('wizard.step.location')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('wizard.locHint')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-800 mb-1.5">{t('create.regionLabel')} <span className="text-rose-500">*</span></label>
          <Controller
            control={control}
            name="regionId"
            render={({ field }) => (
              <SearchCombobox
                value={field.value}
                options={regionOptions}
                placeholder={t('wizard.locSearch')}
                onChange={(id) => { field.onChange(id); }}
              />
            )}
          />
          <FieldError message={(errors.regionId as any)?.message} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-800 mb-1.5">{t('create.districtLabel')} <span className="text-rose-500">*</span></label>
          <Controller
            control={control}
            name="districtId"
            render={({ field }) => (
              <SearchCombobox
                value={field.value}
                options={districtOptions}
                placeholder={t('wizard.locSearch')}
                disabled={!regionId}
                onChange={(id) => field.onChange(id)}
              />
            )}
          />
          <FieldError message={(errors.districtId as any)?.message} />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs">
        <div className="flex items-center gap-2 text-gray-700">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            {latitude && longitude
              ? `${t('create.gpsSet')} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
              : t('create.gpsNearby')}
          </span>
        </div>
        <button type="button" onClick={ctl.handleDetectGPS} disabled={ctl.isLocating} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
          <Navigation className={`w-3.5 h-3.5 ${ctl.isLocating ? 'animate-spin' : ''}`} /> <span>{ctl.isLocating ? t('create.detecting') : t('create.detectGps')}</span>
        </button>
      </div>
    </div>
  );
};

export default LocationStep;
