import React, { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/IntlContext.tsx';

interface MiniMapProps {
  lat: number;
  lon: number;
  label?: string;
  height?: number;
}

/**
 * A lightweight inline Leaflet map.
 * Uses dynamic import so it never breaks SSR.
 */
export const MiniMap: React.FC<MiniMapProps> = ({ lat, lon, label, height = 200 }) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    import('leaflet').then((L) => {
      if (destroyed || !containerRef.current || mapRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [lat, lon],
        zoom: 13,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      const pin = L.divIcon({
        html: `<div style="
          width:28px;height:28px;border-radius:50% 50% 50% 0;
          background:linear-gradient(135deg,#1673E6,#0f4fa8);
          border:3px solid white;
          transform:rotate(-45deg);
          box-shadow:0 2px 10px rgba(22,115,230,0.5);
        "></div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      L.marker([lat, lon], { icon: pin })
        .addTo(map)
        .bindPopup(label || t('detail.location'))
        .openPopup();

      mapRef.current = map;
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lon, label]);

  return (
    <div
      ref={containerRef}
      style={{ height, borderRadius: 16, overflow: 'hidden', border: '1px solid #EBECF0' }}
    />
  );
};
