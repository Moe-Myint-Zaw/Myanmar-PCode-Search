import type { OfflinePack, OfflinePackStatus } from '@maplibre/maplibre-react-native';
import 'expo-sqlite/localStorage/install';

import { AppError } from '@/types/errors';
import { isCoordinateCovered } from './coverage';
import type { OfflineRegion } from './map-config';
import {
    estimateOfflineTileCount,
    MAP_OFFLINE_DOWNLOADS_ENABLED,
    MAP_STYLE_URL,
    MAX_OFFLINE_TILE_COUNT,
} from './map-config';
import { loadMapLibre, requireMapLibre } from './maplibre-runtime';

const MAX_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_LOCALSTORAGE_JSON_SIZE = 10_240; // 10KB for timestamps

export type OfflinePackSummary = {
  id: string;
  name: string;
  regionId: string | null;
  minZoom: number | null;
  maxZoom: number | null;
  bounds: OfflinePack['bounds'];
  state: OfflinePackStatus['state'];
  percentage: number;
  completedBytes: number;
  completedTiles: number;
  lastUpdatedAt: string | null;
};

const PACK_UPDATE_TIMESTAMPS_KEY = 'offline-map-pack-updated-at';

function getPackUpdateTimestamps(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const rawValue = localStorage.getItem(PACK_UPDATE_TIMESTAMPS_KEY);
    if (!rawValue) return {};
    if (rawValue.length > MAX_LOCALSTORAGE_JSON_SIZE) {
      localStorage.removeItem(PACK_UPDATE_TIMESTAMPS_KEY);
      return {};
    }
    const value: unknown = JSON.parse(rawValue);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    localStorage.removeItem(PACK_UPDATE_TIMESTAMPS_KEY);
    return {};
  }
}

function updatePackTimestamp(packId: string, timestamp: string | null): void {
  const timestamps = getPackUpdateTimestamps();
  if (timestamp) timestamps[packId] = timestamp;
  else delete timestamps[packId];
  localStorage.setItem(PACK_UPDATE_TIMESTAMPS_KEY, JSON.stringify(timestamps));
}

function getPackTimestamp(packId: string): string | null {
  return getPackUpdateTimestamps()[packId] ?? null;
}

function summarizePack(pack: OfflinePack, status: OfflinePackStatus): OfflinePackSummary {
  return {
    id: pack.id,
    name: typeof pack.metadata.name === 'string' ? pack.metadata.name : pack.id,
    regionId: typeof pack.metadata.regionId === 'string' ? pack.metadata.regionId : null,
    minZoom: typeof pack.metadata.minZoom === 'number' ? pack.metadata.minZoom : null,
    maxZoom: typeof pack.metadata.maxZoom === 'number' ? pack.metadata.maxZoom : null,
    bounds: pack.bounds,
    state: status.state,
    percentage: status.percentage,
    completedBytes: status.completedResourceSize,
    completedTiles: status.completedTileCount,
    lastUpdatedAt: getPackTimestamp(pack.id),
  };
}

export function setMapNetworkEnabled(enabled: boolean): void {
  loadMapLibre()?.NetworkManager.setConnected(enabled);
}

function requireMapStyle(): string {
  if (!MAP_OFFLINE_DOWNLOADS_ENABLED) {
    throw new AppError(
      'OFFLINE_PACK_DOWNLOAD_FAILED',
      'Offline map downloads are disabled until the map provider confirms terms for regional offline packs.',
    );
  }
  if (!MAP_STYLE_URL) {
    throw new AppError(
      'MAP_STYLE_NOT_CONFIGURED',
      'Configure an offline-download licensed map style before downloading map areas.',
    );
  }
  return MAP_STYLE_URL;
}

export async function listOfflinePacks(): Promise<OfflinePackSummary[]> {
  const { OfflineManager } = requireMapLibre();
  const packs = await OfflineManager.getPacks();
  return Promise.all(packs.map(async (pack) => summarizePack(pack, await pack.status())));
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createOfflinePack(
  region: OfflineRegion,
  onProgress: (pack: OfflinePackSummary) => void,
  onError: (error: AppError) => void,
): Promise<OfflinePackSummary> {
  const { OfflineManager } = requireMapLibre();
  const estimatedTileCount = estimateOfflineTileCount(region);
  const existingPacks = await listOfflinePacks();
  const existingTileCount = existingPacks.reduce((total, pack) => total + pack.completedTiles, 0);
  if (existingTileCount + estimatedTileCount > MAX_OFFLINE_TILE_COUNT) {
    throw new AppError(
      'OFFLINE_PACK_DOWNLOAD_FAILED',
      `This area is estimated at ${estimatedTileCount.toLocaleString()} tiles. Device downloads are limited to ${MAX_OFFLINE_TILE_COUNT.toLocaleString()} tiles in total.`,
    );
  }
  OfflineManager.setTileCountLimit(MAX_OFFLINE_TILE_COUNT);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const pack = await OfflineManager.createPack(
        {
          mapStyle: requireMapStyle(),
          bounds: region.bounds,
          minZoom: region.minZoom,
          maxZoom: region.maxZoom,
          metadata: {
            name: region.name,
            regionId: region.id,
            minZoom: region.minZoom,
            maxZoom: region.maxZoom,
          },
        },
        (progressPack, status) => {
          if (status.state === 'complete') {
            updatePackTimestamp(progressPack.id, new Date().toISOString());
          }
          onProgress(summarizePack(progressPack, status));
        },
        (_failedPack, error) => {
          const appError = new AppError('OFFLINE_PACK_DOWNLOAD_FAILED', error.message);
          lastError = appError;
          onError(appError);
        },
      );
      const status = await pack.status();
      if (status.state === 'complete') updatePackTimestamp(pack.id, new Date().toISOString());
      return summarizePack(pack, status);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  if (lastError instanceof AppError) throw lastError;
  throw new AppError('OFFLINE_PACK_DOWNLOAD_FAILED', 'The selected map area could not be downloaded after multiple attempts.', {
    cause: lastError,
  });
}

export async function setOfflinePackPaused(packId: string, paused: boolean): Promise<void> {
  const { OfflineManager } = requireMapLibre();
  const pack = await OfflineManager.getPack(packId);
  if (!pack) throw new AppError('OFFLINE_PACK_NOT_FOUND', 'The selected map area no longer exists.');
  if (paused) await pack.pause();
  else await pack.resume();
}

export async function updateOfflinePack(packId: string): Promise<void> {
  const { OfflineManager } = requireMapLibre();
  requireMapStyle();
  await OfflineManager.invalidatePack(packId);
  updatePackTimestamp(packId, new Date().toISOString());
}

export async function deleteOfflinePack(packId: string): Promise<void> {
  try {
    const { OfflineManager } = requireMapLibre();
    await OfflineManager.deletePack(packId);
    updatePackTimestamp(packId, null);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('OFFLINE_PACK_NOT_FOUND', 'The selected map area could not be deleted.', {
      cause: error,
    });
  }
}

export { isCoordinateCovered };
