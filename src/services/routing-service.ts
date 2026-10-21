import { AppError } from '@/types/errors';
import type { Coordinates } from '@/types/pcode';

const ROUTING_API_URL =
  process.env.EXPO_PUBLIC_ROUTING_API_URL?.trim() || 'https://router.project-osrm.org';
const ROUTING_TIMEOUT_MS = 15_000;

type OsrmRouteResponse = {
  code?: string;
  routes?: {
    distance?: number;
    duration?: number;
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  }[];
};

export type DrivingRoute = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
};

function isValidCoordinate(longitude: number, latitude: number): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

function parseRouteCoordinates(value: unknown): [number, number][] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const coordinates: [number, number][] = [];
  for (const point of value) {
    if (
      !Array.isArray(point) ||
      point.length < 2 ||
      typeof point[0] !== 'number' ||
      typeof point[1] !== 'number' ||
      !isValidCoordinate(point[0], point[1])
    ) {
      return null;
    }
    coordinates.push([point[0], point[1]]);
  }
  return coordinates;
}

export async function getDrivingRoute(
  origin: Coordinates,
  destination: Coordinates,
  signal?: AbortSignal,
): Promise<DrivingRoute> {
  if (
    !isValidCoordinate(origin.longitude, origin.latitude) ||
    !isValidCoordinate(destination.longitude, destination.latitude)
  ) {
    throw new AppError('ROUTE_UNAVAILABLE', 'Route coordinates are invalid.');
  }

  const url = new URL(
    `/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`,
    ROUTING_API_URL,
  );
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeoutId = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new AppError('ROUTE_UNAVAILABLE', `Routing service returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as OsrmRouteResponse;
    if (payload.code === 'NoRoute' || !payload.routes?.length) {
      throw new AppError('ROUTE_NOT_FOUND', 'No driving route was found for this location.');
    }
    const route = payload.routes[0];
    const coordinates = parseRouteCoordinates(route?.geometry?.coordinates);
    if (
      payload.code !== 'Ok' ||
      route?.geometry?.type !== 'LineString' ||
      !coordinates ||
      typeof route.distance !== 'number' ||
      !Number.isFinite(route.distance) ||
      typeof route.duration !== 'number' ||
      !Number.isFinite(route.duration)
    ) {
      throw new AppError('ROUTE_UNAVAILABLE', 'Routing service returned an invalid route.');
    }

    return {
      coordinates,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError('ROUTE_UNAVAILABLE', 'Route request timed out or was cancelled.', { cause: error });
    }
    throw new AppError('ROUTE_UNAVAILABLE', 'Online route service is unavailable.', { cause: error });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}