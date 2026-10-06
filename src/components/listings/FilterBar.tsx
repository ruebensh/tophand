import React, { useState, useEffect } from 'react';
import { ListingType, Region, District } from '../../types/index.ts';
import { useI18n } from '../../i18n/IntlContext.tsx';
import { MapPin, SlidersHorizontal, X, Compass } from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';

interface FilterBarProps {
  selectedType?: ListingType;
  onTypeChange: (type?: ListingType) => void;
  selectedRegionId?: string;
  onRegionChange: (regionId?: string) => void;
  selectedDistrictId?: string;
  onDistrictChange: (districtId?: string) => void;
  priceMin?: number;
  priceMax?: number;
  onPriceChange: (min?: number, max?: number) => void;
  userLat?: number;
  userLng?: number;
  maxDistanceKm?: number;
  onDistanceChange: (km?: number) => void;
  onRequestGeolocation: () => void;
  isGeoActive: boolean;
  onResetFilters: () => void;
  activeFilterCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedType,
  onTypeChange,
  selectedRegionId,
  onRegionChange,
  selectedDistrictId,
  onDistrictChange,
  priceMin,
  priceMax,
  onPriceChange,
  maxDistanceKm,
  onDistanceChange,
  onRequestGeolocation,
  isGeoActive,
  onResetFilters,
  activeFilterCount,
}) => {
  const { t, localized } = useI18n();
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localPriceMin, setLocalPriceMin] = useState<string>(priceMin ? String(priceMin) : '');
  const [localPriceMax, setLocalPriceMax] = useState<string>(priceMax ? String(priceMax) : '');

  // Load regions
  useEffect(() => {
    apiRequest<Region[]>('/api/locations/regions')
      .then(setRegions)
      .catch(console.error);
  }, []);

  // Load districts when region changes
  useEffect(() => {
    if (!selectedRegionId) {
      setDistricts([]);
      return;
    }
    apiRequest<District[]>(`/api/locations/districts?region_id=${selectedRegionId}`)
      .then(setDistricts)
      .catch(console.error);
  }, [selectedRegionId]);

  const handleApplyPrice = () => {
    const min = localPriceMin ? parseFloat(localPriceMin) : undefined;
    const max = localPriceMax ? parseFloat(localPriceMax) : undefined;
    onPriceChange(min, max);
  };

  const TYPE_TABS: { type?: ListingType; label: string; countColor: string }[] = [
    { type: undefined, label: t('home.tabAll'), countColor: 'bg-gray-100 text-gray-700' },
    { type: 'SERVICE_OFFER', label: t('home.tbServices'), countColor: 'bg-blue-100 text-blue-700' },
    { type: 'SERVICE_REQUEST', label: t('home.tbRequests'), countColor: 'bg-amber-100 text-amber-700' },
    { type: 'JOB_OPENING', label: t('home.tbVacancies'), countColor: 'bg-purple-100 text-purple-700' },
    { type: 'JOB_SEEKER', label: t('home.tbResumes'), countColor: 'bg-emerald-100 text-emerald-700' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 mb-6">
      {/* 1. Type Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-gray-100">
        {TYPE_TABS.map((tab) => {
          const isSelected = selectedType === tab.type;
          return (
            <button
              key={tab.label}
              onClick={() => onTypeChange(tab.type)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2. Region / District / Location bar */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        {/* Region selector */}
        <div className="relative min-w-[160px] flex-1 sm:flex-initial">
          <select
            value={selectedRegionId || ''}
            onChange={(e) => {
              const val = e.target.value || undefined;
              onRegionChange(val);
              onDistrictChange(undefined);
            }}
            aria-label={t('home.pickRegion')}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 appearance-none pr-8 cursor-pointer"
          >
            <option value="">{t('home.allRegions')}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {localized(r)}
              </option>
            ))}
          </select>
          <MapPin className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* District selector */}
        {selectedRegionId && districts.length > 0 && (
          <div className="relative min-w-[160px] flex-1 sm:flex-initial">
            <select
              value={selectedDistrictId || ''}
              onChange={(e) => onDistrictChange(e.target.value || undefined)}
              aria-label={t('home.pickDistrict')}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 appearance-none pr-8 cursor-pointer"
            >
              <option value="">{t('home.allDistricts')}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {localized(d)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* GPS location button */}
        <button
          onClick={onRequestGeolocation}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
            isGeoActive
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
          }`}
          title={t('home.geoTitle')}
        >
          <Compass className={`w-3.5 h-3.5 ${isGeoActive ? 'text-blue-600 animate-spin-slow' : 'text-gray-500'}`} />
          <span>{isGeoActive ? t('home.geoLocated') : t('home.geoNearby')}</span>
        </button>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
            showAdvanced || activeFilterCount > 0
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{t('home.filters')}</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Clear Filters Button */}
        {activeFilterCount > 0 && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {t('common.clear')}
          </button>
        )}
      </div>

      {/* 3. Advanced Filters Drawer */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Price Range */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t('home.priceRangeSection')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder={t('home.priceFromPh')}
                value={localPriceMin}
                onChange={(e) => setLocalPriceMin(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs">—</span>
              <input
                type="number"
                placeholder={t('home.priceToPh')}
                value={localPriceMax}
                onChange={(e) => setLocalPriceMax(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleApplyPrice}
                className="px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>

          {/* Max Distance Slider (when GPS is active) */}
          {isGeoActive && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-gray-700">{t('home.maxDistance')}</label>
                <span className="text-xs font-bold text-blue-600">{maxDistanceKm || 50} km</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={maxDistanceKm || 50}
                onChange={(e) => onDistanceChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
