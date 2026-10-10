import * as Location from 'expo-location';

import { AppError } from '@/types/errors';
import type { Coordinates } from '@/types/pcode';

const LOCATION_TIMEOUT_MS = 15_000;

export async function getCurrentCoordinates(requestPermission = true): Promise<Coordinates> {
  let permission: Location.LocationPermissionResponse;
  try {
    permission = requestPermission
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
  } catch (error) {
    throw new AppError('LOCATION_UNAVAILABLE', 'Location permission could not be checked.', {
      cause: error,
    });
  }
  if (!permission.granted) {
    throw new AppError(
      'LOCATION_PERMISSION_DENIED',
      'Location access is off. Enter coordinates or search for a place instead.',
    );
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new AppError('GPS_TIMEOUT', 'Current location took too long. Try again or enter coordinates.'));
        }, LOCATION_TIMEOUT_MS);
      }),
    ]);
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('LOCATION_UNAVAILABLE', 'Current location is unavailable.', {
      cause: error,
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function watchCurrentCoordinates(
  onUpdate: (coordinates: Coordinates) => void,
  onError: (error: AppError) => void,
  requestPermission = true,
): Promise<Location.LocationSubscription> {
  let permission: Location.LocationPermissionResponse;
  try {
    permission = requestPermission
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
  } catch (error) {
    throw new AppError('LOCATION_UNAVAILABLE', 'Location permission could not be checked.', {
      cause: error,
    });
  }
  if (!permission.granted) {
    throw new AppError(
      'LOCATION_PERMISSION_DENIED',
      'Location access is off. Enter coordinates or search for a place instead.',
    );
  }

  try {
    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10,
        timeInterval: 5_000,
      },
      (position) =>
        onUpdate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (reason) =>
        onError(
          new AppError('LOCATION_UNAVAILABLE', 'Current location is unavailable.', {
            cause: reason,
          }),
        ),
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('LOCATION_UNAVAILABLE', 'Current location is unavailable.', {
      cause: error,
    });
  }
}