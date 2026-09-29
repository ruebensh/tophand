import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, MapPin, Loader2, Navigation, RefreshCw, ExternalLink } from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';

interface NearbyListing {
  id: string;
  title: string;
  type: string;
  district_name: string;
  region_name: string;
  category_name: string;
  latitude: number;
  longitude: number;
  price_type: string;
  price_min: number | null;
  price_max: number | null;
  currency: string;
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

export const NearbyMapModal: React.FC<NearbyMapModalProps> = ({
  isOpen,
  onClose,
  onOpenListing,
  initialLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const [location, setLocation] = useState<DetectedLocation | null>(initialLocation || null);
  const [listings, setListings] = useState<NearbyListing[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [error, setError] = useState('');
  const [selectedListing, setSelectedListing] = useState<NearbyListing | null>(null);

  // Initialize Leaflet map
  const initMap = useCallback((lat: number, lon: number) => {
    if (!mapContainerRef.current) return;

    // If map already exists, just set view
    if (mapRef.current) {
      mapRef.current.setView([lat, lon], 11);
      return;
    }

    // Dynamic import leaflet
    import('leaflet').then((L) => {
      if (!mapContainerRef.current || mapRef.current) return;

      // Fix default marker icon path issue
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapContainerRef.current, {
        center: [lat, lon],
        zoom: 11,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // User location marker (blue pin)
      const userIcon = L.divIcon({
        html: `<div style="
          width:20px;height:20px;border-radius:50%;
          background:linear-gradient(135deg,#1673E6,#0f4fa8);
          border:3px solid white;
          box-shadow:0 2px 8px rgba(22,115,230,0.6);
          animation: pulse 2s infinite;
        "></div>`,
        className: '',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      userMarkerRef.current = L.marker([lat, lon], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b>📍 Sizning joylashuvingiz</b>')
        .openPopup();

      mapRef.current = map;
    });
  }, []);

  // Place listing markers on the map
  const placeMarkers = useCallback((items: NearbyListing[]) => {
    if (!mapRef.current) return;

    import('leaflet').then((L) => {
      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Group listings by district (lat/lon)
      const grouped: Record<string, NearbyListing[]> = {};
      items.forEach((item) => {
        if (!item.latitude || !item.longitude) return;
        const key = `${item.latitude},${item.longitude}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });

      Object.entries(grouped).forEach(([key, group]) => {
        const [lat, lon] = key.split(',').map(Number);

        const count = group.length;
        const icon = L.divIcon({
          html: `<div style="
            min-width:32px;height:32px;padding:0 8px;border-radius:16px;
            background:linear-gradient(135deg,#FF6B35,#E8441E);
            border:2px solid white;
            box-shadow:0 2px 8px rgba(255,107,53,0.5);
            display:flex;align-items:center;justify-content:center;
            color:white;font-size:11px;font-weight:700;font-family:sans-serif;
            cursor:pointer;white-space:nowrap;
          ">${count > 1 ? `${count} ta` : '📋'}</div>`,
          className: '',
          iconSize: [count > 1 ? 52 : 32, 32],
          iconAnchor: [count > 1 ? 26 : 16, 16],
        });

        const popupContent = group
          .slice(0, 3)
          .map(
            (l) =>
              `<div style="padding:4px 0;border-bottom:1px solid #eee;cursor:pointer" data-id="${l.id}">
                <b style="font-size:12px">${l.title}</b>
                <span style="display:block;font-size:10px;color:#888">${l.category_name}</span>
              </div>`
          )
          .join('');

        const marker = L.marker([lat, lon], { icon }).addTo(mapRef.current);
        marker.bindPopup(
          `<div style="min-width:160px;max-width:220px;">
            <p style="font-size:11px;font-weight:700;color:#888;margin-bottom:6px">${group[0].district_name}</p>
            ${popupContent}
            ${group.length > 3 ? `<p style="font-size:10px;color:#1673E6;margin-top:4px">va yana ${group.length - 3} ta...</p>` : ''}
          </div>`,
          { maxWidth: 240 }
        );

        // Click on marker → select first listing
        marker.on('click', () => {
          setSelectedListing(group[0]);
        });

        markersRef.current.push(marker);
      });
    });
  }, []);

  // Detect user location via browser GPS
  const detectLocation = useCallback(() => {
    setIsDetecting(true);
    setError('');

    if (!navigator.geolocation) {
      setError("Brauzer GPS-ni qo'llab-quvvatlamaydi");
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
          initMap(detected.lat, detected.lon);
        } catch {
          setError("Joylashuvni aniqlab bo'lmadi");
        } finally {
          setIsDetecting(false);
        }
      },
      (geoErr) => {
        if (geoErr.code === 1) {
          setError("GPS ruxsati berilmadi. Brauzer sozlamalarini tekshiring.");
        } else {
          setError("GPS signal topilmadi. Qayta urinib ko'ring.");
        }
        setIsDetecting(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [initMap]);

  // Load nearby listings when location changes
  useEffect(() => {
    if (!location) return;
    setIsLoadingListings(true);
    apiRequest<{ items: NearbyListing[] }>(
      `/api/locations/nearby-listings?lat=${location.lat}&lon=${location.lon}&radius=40`
    )
      .then((res) => {
        setListings(res.items);
        placeMarkers(res.items);
      })
      .catch(() => setError("E'lonlar yuklanmadi"))
      .finally(() => setIsLoadingListings(false));
  }, [location, placeMarkers]);

  // Init map when modal opens with initial location
  useEffect(() => {
    if (!isOpen) return;
    if (initialLocation && !location) {
      setLocation(initialLocation);
    }
    if (location) {
      setTimeout(() => initMap(location.lat, location.lon), 100);
    }
  }, [isOpen]);

  // Update markers when listings change and map is ready
  useEffect(() => {
    if (listings.length > 0 && mapRef.current) {
      placeMarkers(listings);
    }
  }, [listings, placeMarkers]);

  // Cleanup map on close
  useEffect(() => {
    if (!isOpen && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current = [];
      userMarkerRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-3xl"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-base">
              📍 Yaqin atrofdagi e'lonlar
            </h2>
            {location && (
              <p className="text-xs text-gray-500 mt-0.5">
                {location.district_name}, {location.region_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={detectLocation}
              disabled={isDetecting}
              title="Joylashuvni yangilash"
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all disabled:opacity-50"
            >
              {isDetecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">
          {/* Map */}
          <div className="relative flex-1 min-h-[240px] sm:min-h-0">
            {!location ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <Navigation className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">GPS joylashuvni aniqlash</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Yaqin atrofdagi e'lonlarni xaritada ko'rish uchun joylashuvingizni aniqlang
                  </p>
                </div>
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    ⚠️ {error}
                  </p>
                )}
                <button
                  onClick={detectLocation}
                  disabled={isDetecting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shadow-md disabled:opacity-60"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Aniqlanmoqda...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4" />
                      Joylashuvni aniqlash
                    </>
                  )}
                </button>
              </div>
            ) : (
              <>
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: 240 }} />
                {isLoadingListings && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      E'lonlar yuklanmoqda...
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right panel: Listing list */}
          {location && (
            <div className="sm:w-[260px] border-t sm:border-t-0 sm:border-l border-gray-100 overflow-y-auto max-h-[260px] sm:max-h-none">
              <div className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  {isLoadingListings ? 'Yuklanmoqda...' : `${listings.length} ta e'lon topildi`}
                </p>

                {listings.length === 0 && !isLoadingListings ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Bu tumanda aktiv e'lonlar yo'q
                  </div>
                ) : (
                  <div className="space-y-2">
                    {listings.slice(0, 20).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onClose();
                          onOpenListing(item.id);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                          selectedListing?.id === item.id
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'
                        }`}
                      >
                        <p className="font-semibold text-xs text-gray-900 leading-tight line-clamp-2">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                          <span className="text-[10px] text-gray-500 truncate">
                            {item.district_name}
                          </span>
                        </div>
                        <span className="text-[10px] text-blue-600 font-medium mt-0.5 block">
                          {item.category_name}
                        </span>
                      </button>
                    ))}
                    {listings.length > 20 && (
                      <p className="text-[10px] text-gray-400 text-center py-1">
                        va yana {listings.length - 20} ta e'lon...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
