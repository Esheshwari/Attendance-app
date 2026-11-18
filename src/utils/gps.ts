import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { GpsLocation, PlaceCategory, WorkMode } from '../types';

export interface GpsCaptureError {
  code: 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'TIMEOUT';
  message: string;
}

export interface ReverseGeoDetails {
  address: string;
  city: string;
  state: string;
  postcode: string;
  placeName: string;
  placeCategory: PlaceCategory;
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function classifyOsmPlace(data: any): { placeName: string; placeCategory: PlaceCategory } {
  const cls = String(data?.class || '').toLowerCase();
  const type = String(data?.type || '').toLowerCase();
  const addr = data?.address || {};
  const extra = data?.extratags || {};
  const rawName = String(
    data?.name ||
      addr.shop ||
      addr.amenity ||
      addr.building ||
      addr.industrial ||
      addr.office ||
      ''
  ).trim();

  const combinedText = `${cls} ${type} ${rawName} ${extra.building || ''} ${extra.landuse || ''}`.toLowerCase();

  // 1. Shop / Retail / Market / Commercial
  if (
    cls === 'shop' ||
    Boolean(addr.shop) ||
    [
      'supermarket',
      'convenience',
      'mall',
      'department_store',
      'marketplace',
      'hardware',
      'chemist',
      'pharmacy',
      'retail',
      'commercial',
      'store',
      'shop',
      'restaurant',
      'cafe',
      'bank',
    ].some((kw) => combinedText.includes(kw))
  ) {
    return {
      placeName: rawName || 'Commercial / Retail Area',
      placeCategory: 'Shop / Commercial',
    };
  }

  // 2. Plant / Industrial / Warehouse
  if (
    Boolean(addr.industrial) ||
    [
      'industrial',
      'factory',
      'warehouse',
      'works',
      'plant',
      'chemical',
      'manufacture',
      'midc',
      'gidc',
      'sez',
    ].some((kw) => combinedText.includes(kw))
  ) {
    return {
      placeName: rawName || addr.industrial || 'Industrial Zone',
      placeCategory: 'Plant / Industrial',
    };
  }

  // 3. Office / Corporate
  if (
    cls === 'office' ||
    Boolean(addr.office) ||
    ['office', 'company', 'corporate', 'business_park', 'tech_park', 'tower'].some((kw) =>
      combinedText.includes(kw)
    )
  ) {
    return {
      placeName: rawName || 'Corporate Office',
      placeCategory: 'Office / Corporate',
    };
  }

  // 4. Home / Residential
  if (
    ['house', 'residential', 'apartments', 'dormitory', 'detached', 'terrace', 'bungalow', 'flat', 'society', 'residency', 'enclave', 'nagar', 'colony'].some(
      (kw) => combinedText.includes(kw)
    ) ||
    Boolean(addr.house_number)
  ) {
    return {
      placeName: rawName || (addr.house_number ? `House / Bldg ${addr.house_number}` : 'Residential Area'),
      placeCategory: 'Home / Residential',
    };
  }

  // 5. Highway / Transit / General Field
  return {
    placeName: rawName || addr.road || 'Field Location',
    placeCategory: 'Field / Transit',
  };
}

export async function reverseGeocodeOsm(lat: number, lng: number): Promise<ReverseGeoDetails> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1&extratags=1&namedetails=1`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Nominatim HTTP ${res.status}`);
    }

    const data = await res.json();
    const addr = data?.address || {};
    const city = String(
      addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.city_district ||
        addr.county ||
        ''
    ).trim();
    const state = String(addr.state || '').trim();
    const postcode = String(addr.postcode || '').trim();

    const streetParts = [
      addr.house_number ? `${addr.house_number}` : '',
      addr.road || addr.pedestrian || '',
      addr.neighbourhood || addr.suburb || addr.residential || addr.industrial || '',
    ].filter(Boolean);

    const { placeName, placeCategory } = classifyOsmPlace(data);

    const fullParts = [
      placeName && !streetParts.join(' ').includes(placeName) ? placeName : '',
      ...streetParts,
      city,
      state,
    ].filter(Boolean);

    const address =
      fullParts.length > 0
        ? Array.from(new Set(fullParts)).slice(0, 4).join(', ')
        : typeof data?.display_name === 'string' && data.display_name.trim()
        ? data.display_name.split(',').slice(0, 4).join(',').trim()
        : `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;

    return {
      address,
      city: city || 'Unknown City',
      state,
      postcode,
      placeName,
      placeCategory,
    };
  } catch {
    return {
      address: `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`,
      city: 'GPS Coordinates Only',
      state: '',
      postcode: '',
      placeName: '',
      placeCategory: 'Field / Transit',
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function captureLiveGps(): Promise<GpsLocation> {
  let lat: number;
  let lng: number;
  let accuracy: number | null = null;

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
          throw {
            code: 'PERMISSION_DENIED',
            message: 'Location permission was denied on this device. Enable GPS permissions or use Demo Mode.',
          } satisfies GpsCaptureError;
        }
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      });

      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      accuracy = typeof pos.coords.accuracy === 'number' ? Math.round(pos.coords.accuracy) : null;
    } catch (err: any) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'PERMISSION_DENIED') {
        throw err;
      }
      throw {
        code: 'UNAVAILABLE',
        message: 'Unable to acquire native device GPS signal. Please check location settings or use Demo Mode.',
      } satisfies GpsCaptureError;
    }
  } else {
    if (!('geolocation' in navigator)) {
      throw {
        code: 'UNAVAILABLE',
        message: 'Geolocation is not supported by this browser. Use Demo Mode to continue.',
      } satisfies GpsCaptureError;
    }

    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        (geoErr) => {
          if (geoErr.code === geoErr.PERMISSION_DENIED) {
            reject({
              code: 'PERMISSION_DENIED',
              message:
                'GPS permission was denied or blocked by preview iframe policy. Grant location access or use Demo Mode below.',
            } satisfies GpsCaptureError);
          } else if (geoErr.code === geoErr.TIMEOUT) {
            reject({
              code: 'TIMEOUT',
              message: 'GPS signal timed out. Move to an open area, retry, or use Demo Mode.',
            } satisfies GpsCaptureError);
          } else {
            reject({
              code: 'UNAVAILABLE',
              message: 'Live GPS coordinates are currently unavailable. Retry or use Demo Mode.',
            } satisfies GpsCaptureError);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });

    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    accuracy = typeof pos.coords.accuracy === 'number' ? Math.round(pos.coords.accuracy) : null;
  }

  const geo = await reverseGeocodeOsm(lat, lng);

  return {
    lat,
    lng,
    accuracy,
    address: geo.address,
    city: geo.city,
    state: geo.state,
    postcode: geo.postcode,
    placeName: geo.placeName,
    placeCategory: geo.placeCategory,
    simulated: false,
  };
}

export async function captureSimulatedGps(workMode: WorkMode): Promise<GpsLocation> {
  const presets: Record<
    WorkMode,
    { lat: number; lng: number; city: string; fallback: string; placeCategory: PlaceCategory; placeName: string }
  > = {
    'On-Site / Plant': {
      lat: 19.0772,
      lng: 73.1128,
      city: 'Navi Mumbai',
      fallback: 'Vantrex Chemicals Plant, MIDC Taloja, Navi Mumbai',
      placeCategory: 'Plant / Industrial',
      placeName: 'MIDC Taloja Industrial Plant',
    },
    'Client Visit / Field': {
      lat: 19.1197,
      lng: 72.8464,
      city: 'Mumbai',
      fallback: 'Andheri East Commercial Market, Mumbai',
      placeCategory: 'Shop / Commercial',
      placeName: 'Commercial Client Shop / Market',
    },
    Remote: {
      lat: 18.5204,
      lng: 73.8567,
      city: 'Pune',
      fallback: 'Shivajinagar Residential Enclave, Pune',
      placeCategory: 'Home / Residential',
      placeName: 'Residential Home Location',
    },
  };

  const base = presets[workMode];
  const jitterLat = base.lat + (Math.random() - 0.5) * 0.0018;
  const jitterLng = base.lng + (Math.random() - 0.5) * 0.0018;

  const geo = await reverseGeocodeOsm(jitterLat, jitterLng);
  const resolvedAddress = geo.address.startsWith('Lat ') ? base.fallback : geo.address;
  const resolvedCity =
    geo.city && geo.city !== 'GPS Coordinates Only' && geo.city !== 'Unknown City'
      ? geo.city
      : base.city;

  return {
    lat: Number(jitterLat.toFixed(6)),
    lng: Number(jitterLng.toFixed(6)),
    accuracy: 12,
    address: resolvedAddress,
    city: resolvedCity,
    state: geo.state,
    postcode: geo.postcode,
    placeName: geo.placeName || base.placeName,
    placeCategory: geo.placeCategory !== 'Field / Transit' ? geo.placeCategory : base.placeCategory,
    simulated: true,
  };
}
