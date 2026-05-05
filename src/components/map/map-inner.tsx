'use client';

import { useEffect, useRef } from 'react';
import { useAllFishFarms } from '@/hooks/use-fish-farms';
import { KECAMATAN_COORDS, DESA_COORDS } from '@/lib/constants';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

// Colors for each kecamatan boundary
const KECAMATAN_COLORS: Record<string, string> = {
  "Anjongan": "#2563eb",
  "Jongkat": "#7c3aed",
  "Mempawah Hilir": "#059669",
  "Mempawah Timur": "#dc2626",
  "Sadaniang": "#d97706",
  "Segedong": "#0891b2",
  "Sungai Kunyit": "#4f46e5",
  "Sungai Pinyuh": "#be185d",
  "Toho": "#65a30d",
};

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  let size = 'small';
  let dimension = 40;
  let color = '#3b82f6';

  if (count >= 50) {
    size = 'large';
    dimension = 56;
    color = '#1e40af';
  } else if (count >= 20) {
    size = 'medium';
    dimension = 48;
    color = '#2563eb';
  }

  return L.divIcon({
    html: `<div style="
      background: ${color};
      color: white;
      border-radius: 50%;
      width: ${dimension}px;
      height: ${dimension}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: ${size === 'large' ? 14 : size === 'medium' ? 12 : 11}px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">${count}</div>`,
    className: `marker-cluster marker-cluster-${size}`,
    iconSize: L.point(dimension, dimension),
  });
}

function hashOffset(str: string, index: number): { latOff: number; lngOff: number } {
  let hash = 0;
  const s = str + String(index);
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const latOff = ((hash % 1000) / 1000 - 0.5) * 0.008;
  const lngOff = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.008;
  return { latOff, lngOff };
}

function getRecordCoords(
  farm: { latitude: number; longitude: number; kecamatan: string; desa: string },
  index: number
): { lat: number; lng: number; isExact: boolean } | null {
  if (farm.latitude && farm.longitude && farm.latitude !== 0 && farm.longitude !== 0) {
    return { lat: farm.latitude, lng: farm.longitude, isExact: true };
  }
  const desaKey = `${farm.kecamatan}|${farm.desa}`;
  const desaCoords = DESA_COORDS[desaKey];
  if (desaCoords) {
    const { latOff, lngOff } = hashOffset(farm.desa + farm.kecamatan, index);
    return { lat: desaCoords.lat + latOff, lng: desaCoords.lng + lngOff, isExact: false };
  }
  const kecCoords = KECAMATAN_COORDS[farm.kecamatan];
  if (!kecCoords) return null;
  const { latOff, lngOff } = hashOffset(farm.desa + farm.kecamatan, index);
  return { lat: kecCoords.lat + latOff, lng: kecCoords.lng + lngOff, isExact: false };
}

// List of GeoJSON files per kecamatan
const GEOJSON_FILES = [
  { file: '/geojson/id6104091_anjongan.geojson', kecamatan: 'Anjongan' },
  { file: '/geojson/id6104080_jongkat.geojson', kecamatan: 'Jongkat' },
  { file: '/geojson/id6104100_mempawah_hilir.geojson', kecamatan: 'Mempawah Hilir' },
  { file: '/geojson/id6104101_mempawah_timur.geojson', kecamatan: 'Mempawah Timur' },
  { file: '/geojson/id6104121_sadaniang.geojson', kecamatan: 'Sadaniang' },
  { file: '/geojson/id6104081_segedong.geojson', kecamatan: 'Segedong' },
  { file: '/geojson/id6104110_sungai_kunyit.geojson', kecamatan: 'Sungai Kunyit' },
  { file: '/geojson/id6104090_sungai_pinyuh.geojson', kecamatan: 'Sungai Pinyuh' },
  { file: '/geojson/id6104120_toho.geojson', kecamatan: 'Toho' },
];

export default function MapInner() {
  const { data } = useAllFishFarms();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const boundaryLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [0.36, 109.0],
      zoom: 10,
      scrollWheelZoom: true,
      minZoom: 8,
      maxZoom: 18,
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    });

    const hybridLayer = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, opacity: 0.4 }),
    ]);

    const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxZoom: 17,
    });

    const baseLayers: Record<string, L.TileLayer | L.LayerGroup> = {
      'Peta Jalan': streetLayer,
      'Satelit': satelliteLayer,
      'Hybrid': hybridLayer,
      'Terrain': terrainLayer,
    };

    streetLayer.addTo(map);
    L.control.layers(baseLayers, {}, { position: 'topright', collapsed: true }).addTo(map);

    mapInstanceRef.current = map;

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: createClusterIcon,
      disableClusteringAtZoom: 15,
      chunkedLoading: true,
      chunkInterval: 50,
    });
    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);

    // Boundary layer group (for desa polygons)
    const boundaryLayer = L.layerGroup();
    boundaryLayerRef.current = boundaryLayer;
    map.addLayer(boundaryLayer);

    // Add boundary toggle control
    L.control.layers({}, { 'Batas Desa': boundaryLayer }, { position: 'topright', collapsed: true }).addTo(map);

    // Load GeoJSON boundary files
    GEOJSON_FILES.forEach(({ file, kecamatan }) => {
      fetch(file)
        .then(res => res.json())
        .then(geojson => {
          const color = KECAMATAN_COLORS[kecamatan] || '#6b7280';
          L.geoJSON(geojson, {
            style: (feature) => ({
              color: color,
              weight: 2,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.08,
              dashArray: feature?.properties?.village ? '0' : '4 4',
            }),
            onEachFeature: (feature, layer) => {
              const village = feature.properties?.village || '';
              const district = feature.properties?.district || kecamatan;
              if (village) {
                layer.bindTooltip(`${district} - ${village}`, {
                  sticky: true,
                  className: 'boundary-tooltip',
                  direction: 'center',
                });
              }
            },
          }).addTo(boundaryLayer);
        })
        .catch(() => {
          // Silently skip if file not found
        });
    });

    // Legend
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', '');
      div.innerHTML = `
        <div style="background:white;padding:8px 12px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.2);font-size:12px;line-height:1.6;">
          <div style="font-weight:600;margin-bottom:4px;">Keterangan</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 100 60" width="24" height="15"><path d="M10,30 L0,10 C25,20 50,10 70,10 C85,10 95,20 95,30 C95,40 85,50 70,50 C50,50 25,40 0,50 Z" fill="#2563eb" stroke="#1d4ed8" stroke-width="2"/><circle cx="78" cy="26" r="5" fill="white"/><circle cx="79" cy="25" r="2.5" fill="#1e293b"/></svg>
            <span>Koordinat pasti</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 100 60" width="24" height="15"><path d="M10,30 L0,10 C25,20 50,10 70,10 C85,10 95,20 95,30 C95,40 85,50 70,50 C50,50 25,40 0,50 Z" fill="#eab308" stroke="#ca8a04" stroke-width="2"/><circle cx="78" cy="26" r="5" fill="white"/><circle cx="79" cy="25" r="2.5" fill="#1e293b"/></svg>
            <span>Lokasi perkiraan (desa)</span>
          </div>
        </div>
      `;
      return div;
    };
    legend.addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      clusterGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !clusterGroupRef.current || !data) return;

    const clusterGroup = clusterGroupRef.current;
    clusterGroup.clearLayers();

    const fishIconSvg = (color: string, strokeColor: string) =>
      `<svg viewBox="0 0 100 60" width="40" height="24" style="filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.35))">` +
      `<path d="M10,30 L0,10 C25,20 50,10 70,10 C85,10 95,20 95,30 C95,40 85,50 70,50 C50,50 25,40 0,50 Z" fill="${color}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M55,10 Q58,2 65,4 Q60,8 58,10" fill="${color}" stroke="${strokeColor}" stroke-width="1.5"/>` +
      `<circle cx="78" cy="26" r="5" fill="white"/>` +
      `<circle cx="79" cy="25" r="2.5" fill="#1e293b"/>` +
      `</svg>`;

    const fishFarmIcon = L.divIcon({
      html: fishIconSvg('#2563eb', '#1d4ed8'),
      className: '',
      iconSize: [40, 24],
      iconAnchor: [20, 12],
      popupAnchor: [0, -14],
    });

    const fallbackIcon = L.divIcon({
      html: fishIconSvg('#eab308', '#ca8a04'),
      className: '',
      iconSize: [40, 24],
      iconAnchor: [20, 12],
      popupAnchor: [0, -14],
    });

    const locationMap = new Map<string, {
      lat: number;
      lng: number;
      kecamatan: string;
      desa: string;
      hasExactCoords: boolean;
      items: { fishType: string; businessType: string; productionQty: number; farmerName: string; groupName: string }[];
    }>();

    data.data.forEach((farm, index) => {
      const coords = getRecordCoords(farm, index);
      if (!coords) return;
      const key = `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          lat: coords.lat, lng: coords.lng,
          kecamatan: farm.kecamatan, desa: farm.desa,
          hasExactCoords: coords.isExact, items: [],
        });
      }
      const loc = locationMap.get(key)!;
      if (coords.isExact) loc.hasExactCoords = true;
      loc.items.push({
        fishType: farm.fishType, businessType: farm.businessType,
        productionQty: farm.productionQty, farmerName: farm.farmerName,
        groupName: farm.groupName,
      });
    });

    for (const [, loc] of locationMap) {
      const totalProd = loc.items.reduce((s, i) => s + i.productionQty, 0);
      const fishTypes = [...new Set(loc.items.map((i) => i.fishType))].join(', ');
      const marker = L.marker([loc.lat, loc.lng], {
        icon: loc.hasExactCoords ? fishFarmIcon : fallbackIcon,
      });

      const itemsList = loc.items.slice(0, 10).map((i) => `
        <tr>
          <td style="padding:1px 4px;">${i.fishType}</td>
          <td style="padding:1px 4px;">${i.businessType}</td>
          <td style="padding:1px 4px;text-align:right;">${formatNumber(i.productionQty)}</td>
          <td style="padding:1px 4px;">${i.farmerName || '-'}</td>
        </tr>
      `).join('');

      const coordLabel = loc.hasExactCoords ? '' : '<span style="font-size:9px;color:#ca8a04;">Lokasi perkiraan (koordinat desa)</span><br/>';

      const popupContent = `
        <div style="font-size:12px;min-width:240px;max-width:320px;color:#E2EDF5;">
          <strong style="font-size:14px;color:#2DD4BF;">${loc.kecamatan} - ${loc.desa}</strong><br/>
          ${coordLabel}
          <span>Jenis Ikan: <strong>${fishTypes}</strong></span><br/>
          <span>Total Produksi: <strong>${formatNumber(totalProd)} kg</strong></span><br/>
          <span>Jumlah Entry: <strong>${loc.items.length}</strong></span>
          ${loc.items.length > 0 ? `
            <table style="margin-top:6px;border-collapse:collapse;font-size:10px;width:100%;">
              <thead>
                <tr style="background:rgba(8,145,178,0.2);border-bottom:1px solid rgba(8,145,178,0.3);">
                  <th style="padding:2px 4px;text-align:left;">Ikan</th>
                  <th style="padding:2px 4px;text-align:left;">Usaha</th>
                  <th style="padding:2px 4px;text-align:right;">Produksi</th>
                  <th style="padding:2px 4px;text-align:left;">Pembudidaya</th>
                </tr>
              </thead>
              <tbody>${itemsList}</tbody>
            </table>
            ${loc.items.length > 10 ? `<div style="font-size:10px;color:#6B8FAE;margin-top:2px;">...dan ${loc.items.length - 10} lainnya</div>` : ''}
          ` : ''}
        </div>
      `;
      marker.bindPopup(popupContent, { maxWidth: 350 });
      clusterGroup.addLayer(marker);
    }

    if (clusterGroup.getLayers().length > 0) {
      mapInstanceRef.current.fitBounds(clusterGroup.getBounds().pad(0.1));
    }
  }, [data]);

  return (
    <>
      <style>{`
        .boundary-tooltip {
          background: rgba(255,255,255,0.92) !important;
          border: 1px solid #94a3b8 !important;
          border-radius: 6px !important;
          padding: 3px 8px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #1e293b !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15) !important;
        }
        .boundary-tooltip::before {
          border-top-color: rgba(255,255,255,0.92) !important;
        }
      `}</style>
      <div
        ref={mapRef}
        className="w-full h-[400px] sm:h-[500px] lg:h-[600px] rounded-lg border"
        style={{ zIndex: 0 }}
      />
    </>
  );
}