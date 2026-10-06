import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Loader2, Navigation, RefreshCw, Briefcase, Wrench, Layers, List } from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';
import { useI18n } from '../../i18n/IntlContext.tsx';

interface MapListing {
  id: string;
  title: string;
  type: 'SERVICE_OFFER' | 'SERVICE_REQUEST' | 'JOB_OPENING' | 'JOB_SEEKER' | string;
  district_name: string;
  region_name: string;
  category_name: string;
  latitude: number | string;
  longitude: number | string;
  price_type?: string;
  price_min?: number | string | null;
  price_max?: number | string | null;
  currency?: string;
}

interface DetectedLocation {
  region_id: string;
  region_name: string;
  district_id: string;
  district_name: string;
  lat: number;
  lon: number;
}

interface NearbyMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenListing: (id: string) => void;
  /** Pre-detected location (if already known) */
  initialLocation?: DetectedLocation | null;
}

type FilterType = 'ALL' | 'SERVICES' | 'JOBS';

export const NearbyMapModal: React.FC<NearbyMapModalProps> = ({
  isOpen,
  onClose,
  onOpenListing,
  initialLocation,
}) => {
  const { t, intlLocale } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const [location, setLocation] = useState<DetectedLocation | null>(initialLocation || null);
  const [listings, setListings] = useState<MapListing[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MapListing | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Xarita ko'rinadigan hududi (bounds) o'zgarganda qayta hisoblash uchun hisoblagich
  const [boundsTick, setBoundsTick] = useState(0);
  // Mobil: xarita to'liq ekran, ro'yxat pastdan ochiladigan shtor; qatlam legendi
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  // Sync initialLocation
  useEffect(() => {
    if (initialLocation) {
      setLocation(initialLocation);
    }
  }, [initialLocation]);

  // Helper to check if a listing is a job
  const isJob = (type: string) => type === 'JOB_OPENING' || type === 'JOB_SEEKER';

  // Filtered listings
  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      // Type filter
      if (filterType === 'SERVICES' && isJob(item.type)) return false;
      if (filterType === 'JOBS' && !isJob(item.type)) return false;

      // Text search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesCat = item.category_name?.toLowerCase().includes(q);
        const matchesLoc = `${item.district_name} ${item.region_name}`.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCat && !matchesLoc) return false;
      }

      return true;
    });
  }, [listings, filterType, searchQuery]);

  // Ro'yxat — faqat xaritada ayni paytda ko'rinib turgan (bounds ichidagi)
  // e'lonlarni ko'rsatadi. Xarita siljitsa/zoomlansa, ro'yxat ham o'zgaradi.
  const visibleListings = useMemo(() => {
    const map = mapRef.current;
    if (!map || typeof map.getBounds !== 'function') return filteredListings;
    let b: any;
    try {
      b = map.getBounds();
    } catch {
      return filteredListings;
    }
    return filteredListings.filter((item) => {
      const lat = parseFloat(String(item.latitude));
      const lon = parseFloat(String(item.longitude));
      if (isNaN(lat) || isNaN(lon)) return false;
      return b.contains([lat, lon]);
    });
    // boundsTick — xarita harakatidan keyin qayta hisoblashni majburlaydi
  }, [filteredListings, boundsTick]);

  // Statistics
  const servicesCount = useMemo(() => listings.filter((l) => !isJob(l.type)).length, [listings]);
  const jobsCount = useMemo(() => listings.filter((l) => isJob(l.type)).length, [listings]);

  // Format price
  const formatPrice = (l: MapListing) => {
    if (l.price_type === 'FREE') return t('price.free');
    if (l.price_type === 'NEGOTIABLE') return t('price.negotiable');
    if (l.price_min) {
      const min = Number(l.price_min).toLocaleString(intlLocale);
      if (l.price_max && Number(l.price_max) > Number(l.price_min)) {
        return `${min} - ${Number(l.price_max).toLocaleString(intlLocale)} ${l.currency || t('map.currencyFallback')}`;
      }
      return `${min} ${l.currency || t('map.currencyFallback')}`;
    }
    return t('price.negotiable');
  };

  // Place markers on the map
  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Group items by district base coords to offset overlaps
    const coordGroups = new Map<string, MapListing[]>();
    filteredListings.forEach((item) => {
      const lat = parseFloat(String(item.latitude));
      const lon = parseFloat(String(item.longitude));
      if (isNaN(lat) || isNaN(lon)) return;
      const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      const list = coordGroups.get(key) || [];
      list.push(item);
      coordGroups.set(key, list);
    });

    coordGroups.forEach((items, key) => {
      const [baseLat, baseLon] = key.split(',').map(Number);
      const count = items.length;

      items.forEach((item, index) => {
        // If multiple items at the same coordinates, offset them in a circle
        let lat = baseLat;
        let lon = baseLon;
        if (count > 1) {
          const angle = (2 * Math.PI * index) / count;
          const radiusOffset = 0.007; // ~700 meters spread
          lat = baseLat + radiusOffset * Math.cos(angle);
          lon = baseLon + (radiusOffset / Math.cos((baseLat * Math.PI) / 180)) * Math.sin(angle);
        }

        const isJobItem = isJob(item.type);
        // Red dot for Jobs, Blue dot for Services
        const dotColor = isJobItem ? '#EF4444' : '#2563EB';
        const typeLabel = isJobItem
          ? (item.type === 'JOB_OPENING' ? t('map.typeJobOpening') : t('map.typeJobSeeker'))
          : (item.type === 'SERVICE_OFFER' ? t('map.typeServiceOffer') : t('map.typeServiceRequest'));

        const circleMarker = L.circleMarker([lat, lon], {
          radius: 8,
          fillColor: dotColor,
          color: '#FFFFFF',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        });

        // Hover animations
        circleMarker.on('mouseover', () => {
          circleMarker.setRadius(11);
          circleMarker.setStyle({ weight: 3 });
        });
        circleMarker.on('mouseout', () => {
          circleMarker.setRadius(8);
          circleMarker.setStyle({ weight: 2 });
        });

        // Popup HTML
        const popupHtml = `
          <div style="font-family: system-ui, sans-serif; min-width: 190px; max-width: 240px; padding: 2px;">
            <div style="display: inline-block; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 700; background: ${isJobItem ? '#FEE2E2' : '#DBEAFE'}; color: ${isJobItem ? '#B91C1C' : '#1D4ED8'}; margin-bottom: 6px;">
              ${typeLabel}
            </div>
            <h4 style="font-size: 12px; font-weight: 700; color: #111827; margin: 0 0 4px; line-height: 1.3;">
              ${item.title.replace(/"/g, '&quot;')}
            </h4>
            <div style="font-size: 11px; color: #4B5563; margin-bottom: 4px;">
              <span>📁 ${item.category_name || t('map.categoryFallback')}</span>
            </div>
            <div style="font-size: 11px; color: #6B7280; margin-bottom: 8px;">
              <span>📍 ${item.district_name}, ${item.region_name}</span>
            </div>
            <div style="font-size: 11px; font-weight: 700; color: ${isJobItem ? '#DC2626' : '#2563EB'}; margin-bottom: 8px;">
              ${formatPrice(item)}
            </div>
            <button
              id="map-btn-${item.id}"
              style="width: 100%; padding: 6px 10px; border-radius: 8px; background: #2563EB; color: #ffffff; font-size: 11px; font-weight: 700; border: none; cursor: pointer; text-align: center;"
            >
              ${t('map.viewListing')}
            </button>
          </div>
        `;

        circleMarker.bindPopup(popupHtml, { maxWidth: 260, offset: [0, -6] });

        // Add event listener to popup button once opened
        circleMarker.on('popupopen', () => {
          setSelectedListing(item);
          setTimeout(() => {
            const btn = document.getElementById(`map-btn-${item.id}`);
            if (btn) {
              btn.onclick = () => {
                onClose();
                onOpenListing(item.id);
              };
            }
          }, 50);
        });

        circleMarker.addTo(map);
        markersRef.current.push(circleMarker);
      });
    });
  }, [filteredListings, onClose, onOpenListing, t]);

  // Load all platform listings
  const loadAllListings = useCallback(async () => {
    setIsLoadingListings(true);
    try {
      const res = await apiRequest<{ items: MapListing[] }>('/api/locations/all-listings');
      setListings(res.items || []);
    } catch (err) {
      console.error("Xarita e'lonlarini yuklashda xatolik:", err);
    } finally {
      setIsLoadingListings(false);
    }
  }, []);

  // Update user marker on map
  const updateUserMarker = useCallback((lat: number, lon: number) => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    const userIcon = L.divIcon({
      html: `
        <div style="position:relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: #3B82F6; opacity: 0.35; animation: pulse 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="position: relative; width: 18px; height: 18px; border-radius: 50%; background: #2563EB; border: 3px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.35);"></div>
        </div>
      `,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    userMarkerRef.current = L.marker([lat, lon], { icon: userIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(`<b style="font-size:12px">${t('map.yourLocation')}</b>`);
  }, [t]);

  // Detect GPS
  const detectLocation = useCallback(() => {
    setIsDetecting(true);
    if (!navigator.geolocation) {
      alert(t('map.gpsUnsupported'));
      setIsDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const detected = await apiRequest<DetectedLocation>(
            `/api/locations/detect?lat=${latitude}&lon=${longitude}`
          );
          setLocation(detected);
          updateUserMarker(latitude, longitude);

          if (mapRef.current) {
            mapRef.current.flyTo([latitude, longitude], 12, { duration: 1.2 });
          }
        } catch (err) {
          console.error('Joylashuvni aniqlashda xatolik:', err);
        } finally {
          setIsDetecting(false);
        }
      },
      () => {
        alert(t('map.gpsDenied'));
        setIsDetecting(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [updateUserMarker, t]);

  // Initialize Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isCancelled = false;

    import('leaflet').then((L) => {
      if (isCancelled || !mapContainerRef.current) return;
      leafletRef.current = L;

      // Fix default marker icon path issue
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapRef.current) {
        // Default center: Uzbekistan center
        const defaultCenter: [number, number] = location
          ? [location.lat, location.lon]
          : [41.3775, 64.5853];
        const defaultZoom = location ? 11 : 6;

        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: defaultZoom,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap',
        }).addTo(map);

        mapRef.current = map;

        // Ro'yxat xaritadagi ko'rinib turgan hududga moslashishi uchun
        map.on('moveend', () => setBoundsTick((t) => t + 1));

        if (location) {
          updateUserMarker(location.lat, location.lon);
        }
      }

      loadAllListings();
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  // Clean up map when modal closes
  useEffect(() => {
    if (!isOpen && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current = [];
      userMarkerRef.current = null;
    }
  }, [isOpen]);

  // Re-render markers whenever filteredListings or map instance changes
  useEffect(() => {
    if (mapRef.current && leafletRef.current && listings.length > 0) {
      renderMarkers();
    }
  }, [filteredListings, renderMarkers]);

  // Focus a specific listing on the map
  const handleFocusListing = (item: MapListing) => {
    setSelectedListing(item);
    const lat = parseFloat(String(item.latitude));
    const lon = parseFloat(String(item.longitude));
    if (!isNaN(lat) && !isNaN(lon) && mapRef.current) {
      mapRef.current.flyTo([lat, lon], 14, { duration: 1 });
    }
  };

  // Mobil suzuvchi boshqaruv: masshtab (+/-)
  const zoomIn = () => mapRef.current?.zoomIn?.();
  const zoomOut = () => mapRef.current?.zoomOut?.();

  // Ro'yxat kartalari — desktop sidebar va mobil pastki shtor o'rtasida ulushiladi.
  const renderListCards = () => (
    <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
      {visibleListings.length === 0 && !isLoadingListings ? (
        <div className="text-center py-10 text-gray-400 text-xs">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
          {t('map.emptyView')}
        </div>
      ) : (
        visibleListings.map((item) => {
          const isJobItem = isJob(item.type);
          const isSelected = selectedListing?.id === item.id;
          return (
            <div
              key={item.id}
              onClick={() => handleFocusListing(item)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? isJobItem
                    ? 'border-red-400 bg-red-50/40 shadow-xs'
                    : 'border-blue-400 bg-blue-50/40 shadow-xs'
                  : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isJobItem ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  {isJobItem ? t('map.badgeJob') : t('map.badgeService')}
                </span>
                <span className="text-[10px] font-bold text-gray-700">{formatPrice(item)}</span>
              </div>
              <h4 className="font-semibold text-xs text-gray-900 line-clamp-1 leading-snug">{item.title}</h4>
              <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                <span className="truncate max-w-[120px]">📍 {item.district_name || item.region_name}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); onOpenListing(item.id); }} className="text-blue-600 font-bold hover:underline">
                  {t('map.viewShort')}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-stretch md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full md:max-w-5xl shadow-2xl flex flex-col overflow-hidden h-full md:rounded-2xl md:h-[92vh] md:max-h-[860px]">
        {/* Header (faqat desktop) */}
        <div className="hidden md:flex items-center justify-between px-6 py-3.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                {t('map.title')}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {t('common.count', { n: listings.length })}
                </span>
              </h2>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                  {t('map.hdrBlue')} ({servicesCount})
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                  {t('map.hdrRed')} ({jobsCount})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={detectLocation}
              disabled={isDetecting}
              title={t('map.detectMeTitle')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('home.detecting')}</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">{t('map.myLocation')}</span>
                </>
              )}
            </button>

            <button
              onClick={loadAllListings}
              disabled={isLoadingListings}
              title={t('map.refreshTitle')}
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingListings ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar (faqat desktop) */}
        <div className="hidden md:flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 bg-gray-50 border-b border-gray-100">
          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {t('common.all')} ({listings.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType('SERVICES')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'SERVICES'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              🔵 {t('home.tabServices')} ({servicesCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterType('JOBS')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'JOBS'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              🔴 {t('home.tabJobs')} ({jobsCount})
            </button>
          </div>

          {/* Quick text filter */}
          <div className="w-full sm:w-60">
            <input
              type="text"
              placeholder={t('map.searchPh')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-800 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>

        {/* Content: Map (left/center) + Sidebar (right) */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0 relative">
          {/* Map Area */}
          <div className="relative flex-1 min-h-[300px] md:min-h-0 bg-gray-100">
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* ── Mobil: yuqori suzuvchi panel (yopish + filtr + qidiruv) ── */}
            <div className="md:hidden absolute top-0 inset-x-0 z-[500] px-3 pt-[max(10px,env(safe-area-inset-top))] pb-1 bg-gradient-to-b from-white via-white/92 to-white/0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-gray-900 text-sm truncate">{t('map.mapTitleMobile')}</span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">{t('common.count', { n: listings.length })}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={loadAllListings} disabled={isLoadingListings} className="w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-600 flex items-center justify-center active:bg-gray-100">
                    <RefreshCw className={`w-4 h-4 ${isLoadingListings ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={onClose} className="w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-600 flex items-center justify-center active:bg-gray-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
                <button onClick={() => setFilterType('ALL')} className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${filterType === 'ALL' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{t('common.all')} ({listings.length})</button>
                <button onClick={() => setFilterType('SERVICES')} className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${filterType === 'SERVICES' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 border border-blue-200'}`}>🔵 {t('home.tabServices')} ({servicesCount})</button>
                <button onClick={() => setFilterType('JOBS')} className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${filterType === 'JOBS' ? 'bg-red-600 text-white' : 'bg-white text-red-700 border border-red-200'}`}>🔴 {t('home.tabJobs')} ({jobsCount})</button>
              </div>
              <input type="text" placeholder={t('map.searchPh')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full mb-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-blue-500" />
            </div>

            {/* ── Mobil: o'ng suzuvchi boshqaruv (qatlam + masshtab + GPS) ── */}
            <div className="md:hidden absolute right-3 top-[46%] -translate-y-1/2 z-[500] flex flex-col gap-2">
              <button onClick={() => setLegendOpen((v) => !v)} className="w-10 h-10 rounded-xl bg-white shadow-md border border-gray-200 flex items-center justify-center active:bg-gray-100">
                <Layers className="w-5 h-5 text-gray-700" />
              </button>
              <div className="flex flex-col rounded-xl bg-white shadow-md border border-gray-200 overflow-hidden">
                <button onClick={zoomIn} className="w-10 h-10 flex items-center justify-center text-xl font-bold text-gray-700 border-b border-gray-100 active:bg-gray-100">+</button>
                <button onClick={zoomOut} className="w-10 h-10 flex items-center justify-center text-xl font-bold text-gray-700 active:bg-gray-100">−</button>
              </div>
              <button onClick={detectLocation} disabled={isDetecting} className="w-10 h-10 rounded-xl bg-white shadow-md border border-gray-200 flex items-center justify-center active:bg-gray-100 disabled:opacity-50">
                {isDetecting ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : <Navigation className="w-5 h-5 text-blue-600" />}
              </button>
            </div>

            {/* Mobil: qatlam (legend) popoveri */}
            {legendOpen && (
              <div className="md:hidden absolute right-16 top-[46%] -translate-y-1/2 z-[500] bg-white/95 backdrop-blur-xs rounded-xl p-2.5 shadow-lg border border-gray-200 text-xs space-y-1.5">
                <div className="font-bold text-gray-800 text-[11px] mb-1">{t('map.legendTitle')}</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block border border-white shadow-xs"></span><span className="text-gray-700 font-medium">{t('home.tabServices')}</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block border border-white shadow-xs"></span><span className="text-gray-700 font-medium">{t('home.tabJobs')}</span></div>
              </div>
            )}

            {/* ── Mobil: pastki-chap "Ro'yxat" tugmasi ── */}
            <button onClick={() => setMobileListOpen(true)} className="md:hidden absolute bottom-5 left-3 z-[500] inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white shadow-lg border border-gray-200 text-sm font-bold text-gray-800 active:bg-gray-50">
              <List className="w-4 h-4 text-blue-600" />
              <span>{t('map.listBtn')}</span>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{visibleListings.length}</span>
            </button>

            {/* ── Mobil: ro'yxat pastki shtori ── */}
            {mobileListOpen && (
              <div className="md:hidden absolute inset-0 z-[600] flex flex-col justify-end" onClick={() => setMobileListOpen(false)}>
                <div className="h-[72%] bg-white rounded-t-3xl flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                    <span className="text-sm font-bold text-gray-800">{t('map.listingsHeader')} ({visibleListings.length})</span>
                    <button onClick={() => setMobileListOpen(false)} className="p-2 rounded-xl text-gray-500 active:bg-gray-200"><X className="w-4 h-4" /></button>
                  </div>
                  {renderListCards()}
                </div>
              </div>
            )}

            {/* Map overlay legend */}
            <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-xs rounded-xl p-2.5 shadow-md border border-gray-200 text-xs space-y-1.5 hidden md:block pointer-events-auto">
              <div className="font-bold text-gray-800 text-[11px] mb-1">{t('map.legendTitle')}</div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block border border-white shadow-xs"></span>
                <span className="text-gray-700 font-medium">{t('map.legendBlue')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block border border-white shadow-xs"></span>
                <span className="text-gray-700 font-medium">{t('map.legendRed')}</span>
              </div>
              {location && (
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <span className="text-blue-600">📍</span>
                  <span className="text-gray-600 font-medium">{t('map.yourArea')}</span>
                </div>
              )}
            </div>

            {/* Loading Indicator */}
            {isLoadingListings && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-[500]">
                <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl shadow-lg border border-gray-100 text-sm text-gray-800 font-semibold">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  {t('map.loadingListings')}
                </div>
              </div>
            )}
          </div>

          {/* Right side: Listings list (faqat desktop) */}
          <div className="hidden md:flex md:w-80 border-l border-gray-200 bg-white flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                {t('map.listingsHeader')} ({visibleListings.length})
              </span>
              {location && (
                <span className="text-[11px] text-blue-600 font-medium truncate max-w-[140px]">
                  📍 {location.district_name}
                </span>
              )}
            </div>

            {renderListCards()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
