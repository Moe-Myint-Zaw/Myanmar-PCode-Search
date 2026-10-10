import type { Coordinates } from '@/types/pcode';

const COORDINATE_PAIR = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/;

// Whitelist of allowed URL schemes for coordinate parsing
const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'geo:', 'maps:']);

function asCoordinates(latitudeText: string, longitudeText: string): Coordinates | null {
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

export function parseCoordinates(value: string): Coordinates | null {
  const input = value.trim();
  if (!input) return null;

  try {
    const url = new URL(input);

    // Validate URL scheme to prevent data exfiltration
    if (!ALLOWED_URL_SCHEMES.has(url.protocol)) {
      return null;
    }

    // Validate hostname to prevent arbitrary domain access
    if (url.hostname) {
      const allowedDomains = ['openstreetmap.org', 'maps.google.com', 'google.com'];
      // Exact match or subdomain of allowed domain
      const isAllowed = allowedDomains.some(domain => {
        return url.hostname === domain || url.hostname.endsWith('.' + domain);
      });
      if (!isAllowed) {
        return null;
      }
    }

    // Check for @ coordinates in path after URL validation
    const mapPathMatch = input.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (mapPathMatch) return asCoordinates(mapPathMatch[1], mapPathMatch[2]);

    for (const key of ['q', 'query', 'll', 'center']) {
      const queryValue = url.searchParams.get(key);
      const pair = queryValue?.match(COORDINATE_PAIR);
      if (pair) return asCoordinates(pair[1], pair[2]);
    }
  } catch {
    // Not a URL, check for plain coordinate patterns below
  }

  // Check for @ coordinates in non-URL input
  const mapPathMatch = input.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (mapPathMatch) return asCoordinates(mapPathMatch[1], mapPathMatch[2]);

  const pair = input.match(COORDINATE_PAIR);
  return pair ? asCoordinates(pair[1], pair[2]) : null;
}