'use client';

import { useEffect, useRef } from 'react';
import { useAllFishFarms } from '@/hooks/use-fish-farms';
import type { FishFarm } from '@/hooks/use-fish-farms';
import { KECAMATAN_COORDS, DESA_COORDS } from '@/lib/constants';
import { generateFarmerId } from '@/lib/farmer-id';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

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

// [A-10] Hoisted to module scope — these divIcons don't depend on `data` and
// were previously recreated on every React Query refetch.
const dotIcon = L.divIcon({
  html: `<div style="
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #2563eb;
    border: 2.5px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.45);
  "></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -9],
});

// Dot icon for markers near group base (slightly different shade)
const dotGroupIcon = L.divIcon({
  html: `<div style="
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #16a34a;
    border: 2.5px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.45);
  "></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -9],
});

// Dot icon for estimated location (desa-level)
const dotEstIcon = L.divIcon({
  html: `<div style="
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #f59e0b;
    border: 2.5px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.45);
  "></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -9],
});

// [A-10] Hoisted to module scope — createPopup only uses `farm` + coord params.
function createPopup(farm: FishFarm, coordLabel: string, lat: number, lng: number) {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const googleStreetUrl = `https://www.google.com/maps/@${lat},${lng},17z/data=!3m1!1e3`;
  return `
    <div style="font-size:13px;min-width:220px;max-width:300px;color:#1e293b;background:#ffffff;padding:10px 12px;border-radius:8px;">
      <strong style="font-size:15px;color:#0d9488;display:block;margin-bottom:6px;">${farm.kecamatan} - ${farm.desa}</strong>
      ${coordLabel}
      <table style="margin-top:4px;border-collapse:collapse;font-size:12px;width:100%;">
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px 4px 0;color:#334155;font-weight:700;white-space:nowrap;">Jenis Ikan</td><td style="padding:4px 0;color:#0f172a;">${farm.fishType || '-'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px 4px 0;color:#334155;font-weight:700;white-space:nowrap;">Wadah Budidaya</td><td style="padding:4px 0;color:#0f172a;">${farm.containerType || '-'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px 4px 0;color:#334155;font-weight:700;white-space:nowrap;">Jenis Usaha</td><td style="padding:4px 0;color:#0f172a;">${farm.businessType || '-'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px 4px 0;color:#334155;font-weight:700;white-space:nowrap;">Pembudidaya</td><td style="padding:4px 0;color:#0f172a;">${farm.farmerName || '-'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px 4px 0;color:#334155;font-weight:700;white-space:nowrap;">Kelompok</td><td style="padding:4px 0;color:#0f172a;">${farm.groupName || '-'}</td></tr>
      </table>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
        <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:5px;background:#0d9488;color:#fff;text-decoration:none;font-size:11px;font-weight:600;">📍 Navigasi</a>
        <a href="${googleStreetUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:5px;background:#2563eb;color:#fff;text-decoration:none;font-size:11px;font-weight:600;">🏙️ Street View</a>
      </div>
    </div>
  `;
}

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
      maxZoom: 20,
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });

    // Google Maps satellite tiles — generally more recent imagery (2024-2026)
    const googleSatelliteLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps',
      maxZoom: 20,
    });

    // Google Maps hybrid (satellite + labels)
    const googleHybridLayer = L.layerGroup([
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
      }),
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
      }),
    ]);

    // Esri World Imagery — alternative satellite source
    const esriSatelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    });

    const esriHybridLayer = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, opacity: 0.4 }),
    ]);

    const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxZoom: 17,
    });

    const baseLayers: Record<string, L.TileLayer | L.LayerGroup> = {
      'Peta Jalan': streetLayer,
      'Satelit Google': googleSatelliteLayer,
      'Hybrid Google': googleHybridLayer,
      'Satelit Esri': esriSatelliteLayer,
      'Hybrid Esri': esriHybridLayer,
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

    // Legend (collapsible on mobile)
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', '');
      const isMobile = window.innerWidth < 640;
      div.innerHTML = `
        <div id="map-legend-container" style="background:white;padding:6px 10px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.2);font-size:12px;color:#1e293b;">
          <div id="map-legend-toggle" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
            <span style="font-weight:700;font-size:13px;">Keterangan</span>
            <span id="map-legend-arrow" style="font-size:10px;transition:transform 0.2s;${isMobile ? 'transform:rotate(-90deg)' : 'transform:rotate(0deg)'}">▼</span>
          </div>
          <div id="map-legend-body" style="${isMobile ? 'display:none;' : ''}margin-top:6px;line-height:1.8;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);flex-shrink:0;"></div>
              <span style="color:#1e293b;">Koordinat pasti</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:14px;height:14px;border-radius:50%;background:#16a34a;border:2.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);flex-shrink:0;"></div>
              <span style="color:#1e293b;">Dekat lokasi kelompok</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:14px;height:14px;border-radius:50%;background:#f59e0b;border:2.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);flex-shrink:0;"></div>
              <span style="color:#1e293b;">Lokasi perkiraan (desa)</span>
            </div>
          </div>
        </div>
      `;
      // Toggle logic
      setTimeout(() => {
        const toggle = div.querySelector('#map-legend-toggle');
        const body = div.querySelector('#map-legend-body') as HTMLElement | null;
        const arrow = div.querySelector('#map-legend-arrow') as HTMLElement | null;
        if (toggle && body && arrow) {
          toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : 'block';
            arrow.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
          });
        }
      }, 0);
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

    // === DEDUPLICATION: avoid double markers when multi-year data exists ===
    // Use farmerId to identify unique farmers. Keep only the latest year's record per farmer.
    const farmerMap = new Map<string, typeof data.data[0]>();
    for (const farm of data.data) {
      const fid = farm.farmerId || generateFarmerId({
        farmerName: farm.farmerName || '',
        groupName: farm.groupName || '',
        kecamatan: farm.kecamatan || '',
        desa: farm.desa || '',
      });
      const existing = farmerMap.get(fid);
      if (!existing || farm.year > existing.year) {
        farmerMap.set(fid, farm);
      }
    }
    const dedupedData = Array.from(farmerMap.values());

    // [A-10] dotIcon / dotGroupIcon / dotEstIcon / createPopup are now module-scope constants

    // Group farms by groupName (using deduped data)
    const groupMap = new Map<string, typeof dedupedData[0][]>();
    const noGroup: typeof dedupedData[0][] = [];

    dedupedData.forEach((farm) => {
      const gn = farm.groupName?.trim();
      if (gn) {
        if (!groupMap.has(gn)) groupMap.set(gn, []);
        groupMap.get(gn)!.push(farm);
      } else {
        noGroup.push(farm);
      }
    });

    // Process farms WITHOUT group (independent markers)
    noGroup.forEach((farm, index) => {
      const coords = getRecordCoords(farm, index);
      if (!coords) return;

      const marker = L.marker([coords.lat, coords.lng], {
        icon: coords.isExact ? dotIcon : dotEstIcon,
      });

      const coordLabel = coords.isExact
        ? ''
        : '<span style="font-size:10px;color:#92400e;background:#fef3c7;padding:1px 4px;border-radius:3px;">Lokasi perkiraan (desa)</span><br/>';

      marker.bindPopup(createPopup(farm, coordLabel, coords.lat, coords.lng), { maxWidth: 350 });
      clusterGroup.addLayer(marker);
    });

    // Process each GROUP — tight spiral 3-5 meter from base
    for (const [, members] of groupMap) {
      const exactMembers = members.filter(
        (f) => f.latitude && f.longitude && f.latitude !== 0 && f.longitude !== 0
      );

      let groupBaseLat: number;
      let groupBaseLng: number;
      let groupHasExact = false;

      if (exactMembers.length > 0) {
        groupBaseLat = exactMembers.reduce((s, f) => s + f.latitude, 0) / exactMembers.length;
        groupBaseLng = exactMembers.reduce((s, f) => s + f.longitude, 0) / exactMembers.length;
        groupHasExact = true;
      } else {
        const first = members[0];
        const desaKey = `${first.kecamatan}|${first.desa}`;
        const desaCoord = DESA_COORDS[desaKey];
        if (desaCoord) {
          groupBaseLat = desaCoord.lat;
          groupBaseLng = desaCoord.lng;
        } else {
          const kecCoord = KECAMATAN_COORDS[first.kecamatan];
          if (!kecCoord) continue;
          groupBaseLat = kecCoord.lat;
          groupBaseLng = kecCoord.lng;
        }
      }

      // Tight spiral: ~3-5 meter offset per member
      // 1 degree lat ≈ 111,320m → 4m ≈ 0.000036 degrees
      members.forEach((farm, idx) => {
        let finalLat: number;
        let finalLng: number;

        if (idx === 0) {
          finalLat = groupBaseLat;
          finalLng = groupBaseLng;
        } else {
          const goldenAngle = 137.508 * (Math.PI / 180);
          const radiusDeg = 0.000036 * Math.sqrt(idx); // ~4m per sqrt(idx)
          const angle = idx * goldenAngle;
          finalLat = groupBaseLat + radiusDeg * Math.cos(angle);
          finalLng = groupBaseLng + (radiusDeg * Math.sin(angle)) / Math.cos((groupBaseLat * Math.PI) / 180);
        }

        const hasExact = !!(farm.latitude && farm.longitude && farm.latitude !== 0 && farm.longitude !== 0);
        let coordLabel: string;
        let icon: L.DivIcon;

        if (hasExact) {
          coordLabel = '';
          icon = dotIcon;
        } else if (groupHasExact) {
          coordLabel = '<span style="font-size:10px;color:#1e40af;background:#dbeafe;padding:1px 4px;border-radius:3px;">Dekat lokasi kelompok</span><br/>';
          icon = dotGroupIcon;
        } else {
          coordLabel = '<span style="font-size:10px;color:#92400e;background:#fef3c7;padding:1px 4px;border-radius:3px;">Lokasi perkiraan (desa)</span><br/>';
          icon = dotEstIcon;
        }

        const marker = L.marker([finalLat, finalLng], { icon });
        marker.bindPopup(createPopup(farm, coordLabel, finalLat, finalLng), { maxWidth: 350 });
        clusterGroup.addLayer(marker);
      });
    }

    if (clusterGroup.getLayers().length > 0) {
      mapInstanceRef.current.fitBounds(clusterGroup.getBounds().pad(0.1));
    }
  }, [data]);

  return (
    <>
      <style>{`
        .leaflet-popup-content-wrapper {
          background: #ffffff !important;
          color: #1e293b !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
        }
        .leaflet-popup-tip {
          background: #ffffff !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
        }        
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