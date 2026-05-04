'use client';

import { useEffect, useRef } from 'react';
import { useAllFishFarms } from '@/hooks/use-fish-farms';
import { KECAMATAN_COORDS } from '@/lib/constants';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

// Custom cluster icon factory - shows count with color coding
function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  let size = 'small';
  let dimension = 40;
  let color = '#0d9488';

  if (count >= 50) {
    size = 'large';
    dimension = 56;
    color = '#065f46';
  } else if (count >= 20) {
    size = 'medium';
    dimension = 48;
    color = '#047857';
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

// Generate a deterministic offset for a string (for spreading markers within same area)
function hashOffset(str: string, index: number): { latOff: number; lngOff: number } {
  let hash = 0;
  const s = str + String(index);
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Use hash to generate a deterministic spread within ~0.01 degrees (~1km)
  const latOff = ((hash % 1000) / 1000 - 0.5) * 0.012;
  const lngOff = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.012;
  return { latOff, lngOff };
}

// Get coordinates for a record - use actual coords if available, otherwise fallback to kecamatan
function getRecordCoords(
  farm: { latitude: number; longitude: number; kecamatan: string; desa: string },
  index: number
): { lat: number; lng: number } | null {
  // If record has valid coordinates, use them
  if (farm.latitude && farm.longitude && farm.latitude !== 0 && farm.longitude !== 0) {
    return { lat: farm.latitude, lng: farm.longitude };
  }

  // Fallback: use kecamatan coordinates with a small offset per desa
  const kecCoords = KECAMATAN_COORDS[farm.kecamatan];
  if (!kecCoords) return null;

  // Generate offset based on desa name + index to spread markers
  const { latOff, lngOff } = hashOffset(farm.desa + farm.kecamatan, index);
  return {
    lat: kecCoords.lat + latOff,
    lng: kecCoords.lng + lngOff,
  };
}

export default function MapInner() {
  const { data } = useAllFishFarms();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [0.27, 109.08],
      zoom: 10,
      scrollWheelZoom: true,
      minZoom: 8,
      maxZoom: 18,
    });

    // === Base Layers ===
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    });

    const hybridLayer = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
      }),
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        opacity: 0.4,
      }),
    ]);

    const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxZoom: 17,
    });

    const baseLayers: Record<string, L.TileLayer | L.LayerGroup> = {
      '🗺️ Peta Jalan': streetLayer,
      '🛰️ Satelit': satelliteLayer,
      '🔄 Hybrid': hybridLayer,
      '⛰️ Terrain': terrainLayer,
    };

    // Add default layer
    streetLayer.addTo(map);

    // Add layer control
    L.control.layers(baseLayers, {}, {
      position: 'topright',
      collapsed: true,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Create the main marker cluster group with custom options
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: createClusterIcon,
      // Disable clustering at high zoom levels so individual markers show
      disableClusteringAtZoom: 15,
      // Chunked loading for performance
      chunkedLoading: true,
      chunkInterval: 50,
    });

    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);

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

    const fishFarmIcon = L.divIcon({
      html: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#0d9488"><path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.5 4.8 3.8 6.2L4 22l4.5-3.2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2zm-1 14h-2v-2h2v2zm0-4h-2V6h2v6z"/></svg>`,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });

    // Fallback icon (slightly different color for records without exact coords)
    const fallbackIcon = L.divIcon({
      html: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#f59e0b"><path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.5 4.8 3.8 6.2L4 22l4.5-3.2c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2zm-1 14h-2v-2h2v2zm0-4h-2V6h2v6z"/></svg>`,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });

    // Process ALL records - both with and without coordinates
    // Group by location for popup info
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
          lat: coords.lat,
          lng: coords.lng,
          kecamatan: farm.kecamatan,
          desa: farm.desa,
          hasExactCoords: farm.latitude !== 0 && farm.longitude !== 0,
          items: [],
        });
      }
      const loc = locationMap.get(key)!;
      // If any record at this location has exact coords, mark as exact
      if (farm.latitude !== 0 && farm.longitude !== 0) {
        loc.hasExactCoords = true;
      }
      loc.items.push({
        fishType: farm.fishType,
        businessType: farm.businessType,
        productionQty: farm.productionQty,
        farmerName: farm.farmerName,
        groupName: farm.groupName,
      });
    });

    for (const [, loc] of locationMap) {
      const totalProd = loc.items.reduce((s, i) => s + i.productionQty, 0);
      const fishTypes = [...new Set(loc.items.map((i) => i.fishType))].join(', ');
      const marker = L.marker([loc.lat, loc.lng], {
        icon: loc.hasExactCoords ? fishFarmIcon : fallbackIcon,
      });

      // Build detailed popup content
      const itemsList = loc.items.slice(0, 10).map((i) => `
        <tr>
          <td style="padding:1px 4px;">${i.fishType}</td>
          <td style="padding:1px 4px;">${i.businessType}</td>
          <td style="padding:1px 4px;text-align:right;">${formatNumber(i.productionQty)}</td>
          <td style="padding:1px 4px;">${i.farmerName || '-'}</td>
        </tr>
      `).join('');

      const coordLabel = loc.hasExactCoords ? '' : '<span style="font-size:9px;color:#f59e0b;">📍 Lokasi perkiraan (koordinat kecamatan)</span><br/>';

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

    // Fit bounds if markers exist
    if (clusterGroup.getLayers().length > 0) {
      mapInstanceRef.current.fitBounds(clusterGroup.getBounds().pad(0.1));
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
