import type * as MapLibre from '@maplibre/maplibre-react-native';
import { isRunningInExpoGo } from 'expo';

import { AppError } from '@/types/errors';

const MAPLIBRE_NATIVE_BUILD_MESSAGE =
  'MapLibre is missing from the installed native app. Rebuild and reinstall the development client with npm run android or npm run ios.';

function isMissingMapLibreModule(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('TurboModuleRegistry.getEnforcing') &&
    error.message.includes('MLRN')
  );
}

export function loadMapLibre(): typeof MapLibre | null {
  if (isRunningInExpoGo()) return null;

  try {
    // Load only after the native registration failure can be handled safely.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@maplibre/maplibre-react-native') as typeof MapLibre;
  } catch (error) {
    if (isMissingMapLibreModule(error)) return null;
    throw error;
  }
}

export function requireMapLibre(): typeof MapLibre {
  const mapLibre = loadMapLibre();
  if (!mapLibre) throw new AppError('MAP_NATIVE_MODULE_MISSING', MAPLIBRE_NATIVE_BUILD_MESSAGE);
  return mapLibre;
}
