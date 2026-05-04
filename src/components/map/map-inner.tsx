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

// Kecamatan-level cluster icon
function createKecamatanIcon(name: string, count: number) {
  return L.divIcon({
    html: `<div style="
      background: linear-gradient(135deg, #0d9488, #065f46);
      color: white;
      border-radius: 12px;
      padding: 6px 12px;
      font-weight: 700;
      font-size: 11px;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      text-align: center;
      min-width: 80px;
      white-space: nowrap;
    "><div style="font-size:10px;opacity:0.9;">${name}</div><div>${count} titik</div></div>`,
    className: '',
    iconSize: [100, 44],
    iconAnchor: [50, 22],
  });
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
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

    // Process data with coordinates
    const recordsWithCoords = data.data.filter(
      (farm) => farm.latitude && farm.longitude && farm.latitude !== 0 && farm.longitude !== 0
    );

    if (recordsWithCoords.length === 0 && data.data.length > 0) {
      // Fallback: Use kecamatan centroids with kecamatan-level clustering
      const kecMap = new Map<string, {
        items: { fishType: string; businessType: string; productionQty: number; farmerName: string; groupName: string }[]
      }>();

      for (const farm of data.data) {
        if (!kecMap.has(farm.kecamatan)) {
          kecMap.set(farm.kecamatan, { items: [] });
        }
        kecMap.get(farm.kecamatan)!.items.push({
          fishType: farm.fishType,
          businessType: farm.businessType,
          productionQty: farm.productionQty,
          farmerName: farm.farmerName,
          groupName: farm.groupName,
        });
      }

      for (const [kec, val] of kecMap) {
        const coords = KECAMATAN_COORDS[kec];
        if (coords) {
          const totalProd = val.items.reduce((s, i) => s + i.productionQty, 0);
          const marker = L.marker([coords.lat, coords.lng], {
            icon: createKecamatanIcon(kec, val.items.length),
          });
          const fishTypes = [...new Set(val.items.map((i) => i.fishType))].join(', ');
          const popupContent = `
            <div style="font-size:12px;min-width:200px;color:#E2EDF5;">
              <strong style="font-size:14px;color:#2DD4BF;">${kec}</strong><br/>
              <span>Jenis Ikan: <strong>${fishTypes}</strong></span><br/>
              <span>Total Produksi: <strong>${formatNumber(totalProd)} kg</strong></span><br/>
              <span>Jumlah Entry: <strong>${val.items.length}</strong></span>
            </div>
          `;
          marker.bindPopup(popupContent);
          clusterGroup.addLayer(marker);
        }
      }
    } else {
      // Add individual markers - clustering will handle grouping automatically
      // Group by location for popup info
      const locationMap = new Map<string, {
        lat: number;
        lng: number;
        kecamatan: string;
        desa: string;
        items: { fishType: string; businessType: string; productionQty: number; farmerName: string; groupName: string }[];
      }>();

      for (const farm of recordsWithCoords) {
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
          farmerName: farm.farmerName,
          groupName: farm.groupName,
        });
      }

      for (const [, loc] of locationMap) {
        const totalProd = loc.items.reduce((s, i) => s + i.productionQty, 0);
        const fishTypes = [...new Set(loc.items.map((i) => i.fishType))].join(', ');
        const marker = L.marker([loc.lat, loc.lng], { icon: fishFarmIcon });

        // Build detailed popup content
        const itemsList = loc.items.slice(0, 10).map((i) => `
          <tr>
            <td style="padding:1px 4px;">${i.fishType}</td>
            <td style="padding:1px 4px;">${i.businessType}</td>
            <td style="padding:1px 4px;text-align:right;">${formatNumber(i.productionQty)}</td>
            <td style="padding:1px 4px;">${i.farmerName || '-'}</td>
          </tr>
        `).join('');

        const popupContent = `
          <div style="font-size:12px;min-width:240px;max-width:320px;color:#E2EDF5;">
            <strong style="font-size:14px;color:#2DD4BF;">${loc.kecamatan} - ${loc.desa}</strong><br/>
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
