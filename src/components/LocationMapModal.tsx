import React from 'react';
import { ExternalLink, MapPin, X } from 'lucide-react';
import type { GpsLocation } from '../types';
import { buildGoogleMapsUrl } from '../utils/gps';
import { LocationTraceMap, type MapMarkerPoint, type MapRouteLine } from './LocationTraceMap';

interface LocationMapModalProps {
  isOpen: boolean;
  title: string;
  entryLocation: GpsLocation | null;
  exitLocation?: GpsLocation | null;
  entryLabel?: string;
  exitLabel?: string;
  onClose: () => void;
}

export function LocationMapModal({
  isOpen,
  title,
  entryLocation,
  exitLocation,
  entryLabel = 'Punch-In Location',
  exitLabel = 'Punch-Out Location',
  onClose,
}: LocationMapModalProps) {
  if (!isOpen || !entryLocation) return null;

  const markers: MapMarkerPoint[] = [
    {
      id: 'entry',
      lat: entryLocation.lat,
      lng: entryLocation.lng,
      title: entryLabel,
      subtitle: entryLocation.address,
      city: entryLocation.city,
      placeCategory: entryLocation.placeCategory,
      color: 'blue',
      mapsUrl: buildGoogleMapsUrl(entryLocation.lat, entryLocation.lng),
    },
  ];

  const routeLines: MapRouteLine[] = [];

  if (exitLocation) {
    markers.push({
      id: 'exit',
      lat: exitLocation.lat,
      lng: exitLocation.lng,
      title: exitLabel,
      subtitle: exitLocation.address,
      city: exitLocation.city,
      placeCategory: exitLocation.placeCategory,
      color: 'slate',
      mapsUrl: buildGoogleMapsUrl(exitLocation.lat, exitLocation.lng),
    });

    routeLines.push({
      from: [entryLocation.lat, entryLocation.lng],
      to: [exitLocation.lat, exitLocation.lng],
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-modal-title"
    >
      <div className="w-full max-w-[440px] bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl p-5 pb-safe space-y-4">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-1 sm:hidden" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-5 h-5 text-[#1e40af] shrink-0" />
            <h3 id="map-modal-title" className="text-base font-bold text-slate-900 truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close map trace"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <LocationTraceMap markers={markers} routeLines={routeLines} heightClass="h-64" />

        <div className="space-y-2.5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#1e40af]">{entryLabel}</span>
              <span className="text-[11px] font-semibold text-slate-700">
                {[entryLocation.placeCategory, entryLocation.city].filter(Boolean).join(' · ')}
              </span>
            </div>
            <p className="text-xs text-slate-800 leading-snug">{entryLocation.address}</p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono-tabular text-slate-500">
                {entryLocation.lat.toFixed(6)}, {entryLocation.lng.toFixed(6)}
                {entryLocation.accuracy !== null ? ` · ±${entryLocation.accuracy}m` : ''}
              </span>
              <a
                href={buildGoogleMapsUrl(entryLocation.lat, entryLocation.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e40af] hover:underline"
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {exitLocation && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">{exitLabel}</span>
                <span className="text-[11px] font-semibold text-slate-700">
                  {[exitLocation.placeCategory, exitLocation.city].filter(Boolean).join(' · ')}
                </span>
              </div>
              <p className="text-xs text-slate-800 leading-snug">{exitLocation.address}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono-tabular text-slate-500">
                  {exitLocation.lat.toFixed(6)}, {exitLocation.lng.toFixed(6)}
                  {exitLocation.accuracy !== null ? ` · ±${exitLocation.accuracy}m` : ''}
                </span>
                <a
                  href={buildGoogleMapsUrl(exitLocation.lat, exitLocation.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e40af] hover:underline"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
