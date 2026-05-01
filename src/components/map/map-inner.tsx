'use client';

import { useEffect, useRef } from 'react';
import { useAllFishFarms } from '@/hooks/use-fish-farms';
import { KECAMATAN_COORDS } from '@/lib/constants';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

export default function MapInner() {
  const { data } = useAllFishFarms();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [0.08, 109.18],
      zoom: 10,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current || !data) return;

    markersRef.current.clearLayers();

    const fishFarmIcon = L.divIcon({
      html: `<svg viewBox="0 0 24 24" width="28" height="28" fill="#0d9488"><path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.5 4.8 3.8 6.2L4 22l4.5-3.2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2zm-1 14h-2v-2h2v2zm0-4h-2V6h2v6z"/></svg>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });

    // Group by kecamatan+desa and aggregate
    const locationMap = new Map<string, {
      lat: number;
      lng: number;
      kecamatan: string;
      desa: string;
      items: { fishType: string; businessType: string; productionQty: number }[];
    }>();

    for (const farm of data.data) {
      if (farm.latitude && farm.longitude && farm.latitude !== 0 && farm.longitude !== 0) {
        const key = `${farm.kecamatan}-${farm.desa}-${farm.latitude}-${farm.longitude}`;
        if (!locationMap.has(key)) {
          locationMap.set(key, {
            lat: farm.latitude,
            lng: farm.longitude,
            kecamatan: farm.kecamatan,
            desa: farm.desa,
            items: [],
          });
        }
        locationMap.get(key)!.items.push({
          fishType: farm.fishType,
          businessType: farm.businessType,
          productionQty: farm.productionQty,
        });
      }
    }

    // If no coordinates, use kecamatan centroids
    if (locationMap.size === 0 && data.data.length > 0) {
      const kecMap = new Map<string, { items: { fishType: string; businessType: string; productionQty: number }[] }>();
      for (const farm of data.data) {
        if (!kecMap.has(farm.kecamatan)) {
          kecMap.set(farm.kecamatan, { items: [] });
        }
        kecMap.get(farm.kecamatan)!.items.push({
          fishType: farm.fishType,
          businessType: farm.businessType,
          productionQty: farm.productionQty,
        });
      }

      for (const [kec, val] of kecMap) {
        const coords = KECAMATAN_COORDS[kec];
        if (coords) {
          const totalProd = val.items.reduce((s, i) => s + i.productionQty, 0);
          const marker = L.marker([coords.lat, coords.lng], { icon: fishFarmIcon });
          const popupContent = `
            <div style="font-size:12px;min-width:180px;">
              <strong style="font-size:13px;">${kec}</strong><br/>
              <span>Total Produksi: <strong>${formatNumber(totalProd)} kg</strong></span><br/>
              <span>Jumlah Entry: <strong>${val.items.length}</strong></span>
            </div>
          `;
          marker.bindPopup(popupContent);
          markersRef.current!.addLayer(marker);
        }
      }
    } else {
      for (const [, loc] of locationMap) {
        const totalProd = loc.items.reduce((s, i) => s + i.productionQty, 0);
        const fishTypes = [...new Set(loc.items.map((i) => i.fishType))].join(', ');
        const marker = L.marker([loc.lat, loc.lng], { icon: fishFarmIcon });
        const popupContent = `
          <div style="font-size:12px;min-width:180px;">
            <strong style="font-size:13px;">${loc.kecamatan} - ${loc.desa}</strong><br/>
            <span>Jenis Ikan: <strong>${fishTypes}</strong></span><br/>
            <span>Total Produksi: <strong>${formatNumber(totalProd)} kg</strong></span><br/>
            <span>Jumlah Entry: <strong>${loc.items.length}</strong></span>
          </div>
        `;
        marker.bindPopup(popupContent);
        markersRef.current!.addLayer(marker);
      }
    }

    // Fit bounds if markers exist
    if (markersRef.current.getLayers().length > 0) {
      const group = L.featureGroup(markersRef.current.getLayers() as L.Layer[]);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [data]);

  return (
    <div
      ref={mapRef}
      className="w-full h-[400px] sm:h-[500px] lg:h-[600px] rounded-lg border"
      style={{ zIndex: 0 }}
    />
  );
}
