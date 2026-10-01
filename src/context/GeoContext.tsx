import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../lib/api.ts';

export interface GeoRegion {
  region_id: string;
  region_name: string;
  district_id?: string;
  district_name?: string;
}

export interface GeoCoords {
  lat: number;
  lng: number;
}

type GeoPermission = 'unknown' | 'prompting' | 'granted' | 'denied';

interface GeoContextType {
  coords: GeoCoords | null;
  region: GeoRegion | null;
  permission: GeoPermission;
  isDetecting: boolean;
  /** Foydalanuvchi rad etganda yoki qo'lda hudud tanlaganda */
  setManualRegion: (region: GeoRegion | null) => void;
  /** GPS ni qayta so'rash/aniqlash */
  requestLocation: () => void;
}

const LS_COORDS = 'th_geo_coords';
const LS_REGION = 'th_geo_region';
const LS_MANUAL = 'th_geo_manual';

const GeoContext = createContext<GeoContextType>({
  coords: null,
  region: null,
  permission: 'unknown',
  isDetecting: false,
  setManualRegion: () => {},
  requestLocation: () => {},
});

function readLS<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const GeoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [coords, setCoords] = useState<GeoCoords | null>(() => readLS<GeoCoords>(LS_COORDS));
  const [region, setRegion] = useState<GeoRegion | null>(() => readLS<GeoRegion>(LS_REGION));
  const [manual, setManual] = useState<boolean>(() => readLS<boolean>(LS_MANUAL) ?? false);
  const [permission, setPermission] = useState<GeoPermission>('unknown');
  const [isDetecting, setIsDetecting] = useState(false);
  const watchId = useRef<number | null>(null);
  const detectTimer = useRef<any>(null);
  const lastCommitted = useRef<GeoCoords | null>(coords);

  // Manual tanlash region'ni ustun qo'yadi
  const effectiveRegion = manual ? region : region;

  const applyCoords = useCallback((c: GeoCoords) => {
    // GPS jitter himoyasi: juda mayda siljishlarni (≈<50m) e'tiborga olmaymiz —
    // aks holda watchPosition doimiy yangilanishlar bilan butun UI/qidiruvni
    // qayta render qilib "o'chib-yonish" (flicker) ni keltirib chiqaradi.
    const last = lastCommitted.current;
    if (last) {
      const dLat = Math.abs(last.lat - c.lat);
      const dLng = Math.abs(last.lng - c.lng);
      if (dLat < 0.0005 && dLng < 0.0005) return;
    }
    lastCommitted.current = c;
    setCoords(c);
    try { localStorage.setItem(LS_COORDS, JSON.stringify(c)); } catch { /* ignore */ }
    // Debounced region detect
    if (detectTimer.current) clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(async () => {
      if (readLS<boolean>(LS_MANUAL)) return; // user chose manually → don't override
      try {
        setIsDetecting(true);
        const det = await apiRequest<GeoRegion & { lat: number; lon: number }>(
          `/api/locations/detect?lat=${c.lat}&lon=${c.lng}`
        );
        const r: GeoRegion = {
          region_id: det.region_id,
          region_name: det.region_name,
          district_id: det.district_id,
          district_name: det.district_name,
        };
        setRegion(r);
        try { localStorage.setItem(LS_REGION, JSON.stringify(r)); } catch { /* ignore */ }
      } catch {
        /* keep last known */
      } finally {
        setIsDetecting(false);
      }
    }, 800);
  }, []);

  const startWatch = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setPermission('denied');
      return;
    }
    setPermission((p) => (p === 'granted' ? p : 'prompting'));
    if (watchId.current != null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPermission('granted');
        applyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermission('denied');
      },
      { enableHighAccuracy: false, maximumAge: 120000, timeout: 20000 }
    );
  }, [applyCoords]);

  const requestLocation = useCallback(() => {
    setManual(false);
    try { localStorage.setItem(LS_MANUAL, JSON.stringify(false)); } catch { /* ignore */ }
    startWatch();
  }, [startWatch]);

  const setManualRegion = useCallback((r: GeoRegion | null) => {
    if (r) {
      setRegion(r);
      setManual(true);
      try {
        localStorage.setItem(LS_REGION, JSON.stringify(r));
        localStorage.setItem(LS_MANUAL, JSON.stringify(true));
      } catch { /* ignore */ }
    } else {
      setRegion(null);
      setManual(false);
      try {
        localStorage.removeItem(LS_REGION);
        localStorage.setItem(LS_MANUAL, JSON.stringify(false));
      } catch { /* ignore */ }
    }
  }, []);

  // Mount: bir marta GPS ni orqa fonda ishga tushirish (doimiy).
  useEffect(() => {
    startWatch();
    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (detectTimer.current) clearTimeout(detectTimer.current);
    };
  }, [startWatch]);

  return (
    <GeoContext.Provider
      value={{
        coords,
        region: effectiveRegion,
        permission,
        isDetecting,
        setManualRegion,
        requestLocation,
      }}
    >
      {children}
    </GeoContext.Provider>
  );
};

export const useGeo = () => useContext(GeoContext);
