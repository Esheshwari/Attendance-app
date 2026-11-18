import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarkerPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  city?: string;
  placeCategory?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'slate';
  mapsUrl?: string;
}

export interface MapRouteLine {
  from: [number, number];
  to: [number, number];
}

interface LocationTraceMapProps {
  markers: MapMarkerPoint[];
  routeLines?: MapRouteLine[];
  heightClass?: string;
}

const COLOR_HEX: Record<NonNullable<MapMarkerPoint['color']>, string> = {
  blue: '#1e40af',
  emerald: '#047857',
  amber: '#b45309',
  slate: '#475569',
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createPinIcon(hex: string) {
  return L.divIcon({
    className: 'vantrex-map-pin',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:${hex};border:3px solid #ffffff;box-shadow:0 2px 8px rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;"><div style="width:7px;height:7px;border-radius:9999px;background:#ffffff;"></div></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

export function LocationTraceMap({
  markers,
  routeLines = [],
  heightClass = 'h-60',
}: LocationTraceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([19.076, 72.8777], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const timer = window.setTimeout(() => map.invalidateSize(), 150);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (markers.length === 0) return;

    const bounds = L.latLngBounds([]);

    for (const line of routeLines) {
      L.polyline([line.from, line.to], {
        color: '#2563eb',
        weight: 3,
        dashArray: '6 6',
        opacity: 0.85,
      }).addTo(group);
      bounds.extend(line.from);
      bounds.extend(line.to);
    }

    for (const pt of markers) {
      const hex = COLOR_HEX[pt.color || 'blue'];
      const marker = L.marker([pt.lat, pt.lng], {
        icon: createPinIcon(hex),
      }).addTo(group);

      const popupLines = [
        `<div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:170px;line-height:1.4;">`,
        `<div style="font-weight:700;font-size:13px;color:#0f172a;">${escapeHtml(pt.title)}</div>`,
        pt.placeCategory || pt.city
          ? `<div style="font-size:11px;font-weight:600;color:#1e40af;margin-top:2px;">${escapeHtml(
              [pt.placeCategory, pt.city].filter(Boolean).join(' · ')
            )}</div>`
          : '',
        pt.subtitle
          ? `<div style="font-size:11px;color:#475569;margin-top:3px;">${escapeHtml(pt.subtitle)}</div>`
          : '',
        `<div style="font-family:monospace;font-size:10px;color:#64748b;margin-top:3px;">${pt.lat.toFixed(
          5
        )}, ${pt.lng.toFixed(5)}</div>`,
        pt.mapsUrl
          ? `<a href="${escapeHtml(
              pt.mapsUrl
            )}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:5px;font-size:11px;font-weight:600;color:#1e40af;text-decoration:underline;">Open in Google Maps</a>`
          : '',
        `</div>`,
      ].join('');

      marker.bindPopup(popupLines);
      bounds.extend([pt.lat, pt.lng]);
    }

    if (markers.length === 1 && routeLines.length === 0) {
      map.setView([markers[0].lat, markers[0].lng], 16);
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    }

    window.setTimeout(() => map.invalidateSize(), 100);
  }, [markers, routeLines]);

  return (
    <div className={`w-full ${heightClass} rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative z-0`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
