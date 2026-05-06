"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { KECAMATAN_COORDS, DESA_COORDS } from "@/lib/constants";

// Fix default marker icon issue in Next.js
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Fish type emoji mapping
const FISH_EMOJI: Record<string, string> = {
  Mas: "🐟",
  Nila: "🐟",
  Lele: "🐟",
  Patin: "🐟",
  Jelawat: "🐟",
  "Bawal Air Tawar": "🐟",
  Gurame: "🐟",
  Vaname: "🦐",
  Lainnya: "🐟",
};

// Create custom div icon per fish type
function createFishIcon(fishType: string): L.DivIcon {
  const emoji = FISH_EMOJI[fishType] || "🐟";
  return L.divIcon({
    className: "custom-fish-marker",
    html: `<div style="
      font-size: 22px;
      text-align: center;
      line-height: 28px;
      width: 28px;
      height: 28px;
      filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.6));
    ">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

// Golden angle spiral offset for markers at the same coordinate
// This ensures each farmer gets a visible, clickable marker
function spiralOffset(
  index: number,
  baseLat: number,
  baseLng: number
): { lat: number; lng: number } {
  if (index === 0) return { lat: baseLat, lng: baseLng };

  const goldenAngle = 137.508 * (Math.PI / 180); // ~2.3998 radians
  const radius = 0.0012 * Math.sqrt(index); // ~133m offset per sqrt(index)
  const angle = index * goldenAngle;

  // Adjust longitude offset for latitude (degrees are shorter at higher latitudes)
  return {
    lat: baseLat + radius * Math.cos(angle),
    lng: baseLng + (radius * Math.sin(angle)) / Math.cos((baseLat * Math.PI) / 180),
  };
}

interface MarkerData {
  id: number;
  kecamatan: string;
  desa: string;
  fishType: string;
  containerType: string;
  businessType: string;
  productionQty: number;
  farmerName: string;
  groupName: string;
  year: number;
  lat: number;
  lng: number;
}

// GeoJSON style for kecamatan boundaries
const geoJsonStyle: L.PathOptions = {
  color: "#2563eb",
  weight: 2,
  opacity: 0.6,
  fillColor: "#3b82f6",
  fillOpacity: 0.05,
};

// Popup row style helper
function popupRow(label: string, value: string | number) {
  return (
    <tr>
      <td
        style={{
          fontWeight: "bold",
          padding: "3px 8px 3px 0",
          whiteSpace: "nowrap",
          color: "#555",
          verticalAlign: "top",
        }}
      >
        {label}
      </td>
      <td style={{ padding: "3px 0" }}>{value || "-"}</td>
    </tr>
  );
}

export default function MapInner() {
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [geoData, setGeoData] = useState<GeoJSON.GeoJsonObject | null>(null);

  // Load GeoJSON boundaries
  useEffect(() => {
    fetch("/api/geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load GeoJSON");
        return res.json();
      })
      .then((data) => setGeoData(data))
      .catch((err) => console.error("GeoJSON load error:", err));
  }, []);

  // Load fish farms and create INDIVIDUAL markers with spiral offset
  useEffect(() => {
    async function loadFishFarms() {
      try {
        const res = await fetch("/api/fish-farms?pageSize=1000");
        if (!res.ok) throw new Error("Failed to load fish farms");
        const result = await res.json();

        // Handle both array and paginated response formats
        const farms = Array.isArray(result) ? result : result.data || [];

        // Track coordinate usage count for spiral offset
        const coordUsage = new Map<string, number>();
        let skipped = 0;

        const markerData: MarkerData[] = [];

        for (const farm of farms) {
          // Determine coordinates: try desa-level first, then kecamatan-level
          let lat: number | undefined;
          let lng: number | undefined;

          const desaKey = `${farm.kecamatan}|${farm.desa}`;
          const desaCoord = DESA_COORDS[desaKey];
          if (desaCoord) {
            lat = desaCoord.lat;
            lng = desaCoord.lng;
          }

          // Fallback to kecamatan coordinates
          if (lat === undefined || lng === undefined) {
            const kecCoord = KECAMATAN_COORDS[farm.kecamatan];
            if (kecCoord) {
              lat = kecCoord.lat;
              lng = kecCoord.lng;
            }
          }

          // Skip if no coordinates found at all
          if (lat === undefined || lng === undefined) {
            skipped++;
            continue;
          }

          // Apply spiral offset for markers at same location
          const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
          const index = coordUsage.get(coordKey) || 0;
          coordUsage.set(coordKey, index + 1);

          const offset = spiralOffset(index, lat, lng);

          markerData.push({
            id: farm.id,
            kecamatan: farm.kecamatan || "-",
            desa: farm.desa || "-",
            fishType: farm.fishType || "-",
            containerType: farm.containerType || "-",
            businessType: farm.businessType || "-",
            productionQty: farm.productionQty || 0,
            farmerName: farm.farmerName || "-",
            groupName: farm.groupName || "-",
            year: farm.year,
            lat: offset.lat,
            lng: offset.lng,
          });
        }

        setMarkers(markerData);
        console.log(
          `📍 Map markers: ${markerData.length} loaded, ${skipped} skipped (no coords), ${coordUsage.size} unique locations, max overlap: ${Math.max(...coordUsage.values())}`
        );
      } catch (err) {
        console.error("Failed to load fish farms:", err);
      }
    }

    loadFishFarms();
  }, []);

  // Memoize GeoJSON layer to prevent re-renders
  const geoJsonLayer = useMemo(() => {
    if (!geoData) return null;
    return <GeoJSON key="kec-boundaries" data={geoData} style={geoJsonStyle} />;
  }, [geoData]);

  return (
    <MapContainer
      center={[0.35, 109.1]}
      zoom={10}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {geoJsonLayer}

      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={createFishIcon(marker.fishType)}
          >
            <Popup>
              <div style={{ minWidth: 220 }}>
                <table
                  style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    fontSize: "13px",
                  }}
                >
                  <tbody>
                    {popupRow("Kecamatan", marker.kecamatan)}
                    {popupRow("Desa", marker.desa)}
                    {popupRow("Kelompok", marker.groupName)}
                    {popupRow("Jenis Ikan", marker.fishType)}
                    {popupRow("Wadah Budidaya", marker.containerType)}
                    {popupRow("Jenis Usaha", marker.businessType)}
                    {popupRow("Jumlah Produksi", marker.productionQty?.toLocaleString("id-ID") || 0)}
                    {popupRow("Pembudidaya", marker.farmerName)}
                  </tbody>
                </table>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}