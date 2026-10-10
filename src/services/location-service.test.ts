import * as Location from 'expo-location';

import { getCurrentCoordinates, watchCurrentCoordinates } from './location-service';

jest.mock('expo-location', () => ({
  ...jest.requireActual<typeof import('expo-location')>('expo-location'),
  getCurrentPositionAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

const grantedPermission = {
  status: Location.PermissionStatus.GRANTED,
  expires: 'never',
  granted: true,
  canAskAgain: true,
} satisfies Location.LocationPermissionResponse;

describe('watchCurrentCoordinates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads the current fix without repeating a permission prompt', async () => {
    const position = {
      coords: {
        latitude: 16.8,
        longitude: 96.15,
        altitude: null,
        accuracy: 10,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1,
    } satisfies Location.LocationObject;
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(grantedPermission);
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue(position);

    await expect(getCurrentCoordinates(false)).resolves.toEqual({
      latitude: 16.8,
      longitude: 96.15,
    });

    expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests permission and reports each foreground location update', async () => {
    const update = jest.fn();
    const subscription = { remove: jest.fn() };
    const watch = jest.mocked(Location.watchPositionAsync);
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue(grantedPermission);
    watch.mockImplementation(async (_options, callback) => {
      callback({
        coords: {
          latitude: 16.8,
          longitude: 96.15,
          altitude: null,
          accuracy: 10,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: 1,
      });
      return subscription;
    });

    await expect(watchCurrentCoordinates(update, jest.fn())).resolves.toBe(subscription);

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(watch).toHaveBeenCalledWith(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 5_000 },
      expect.any(Function),
      expect.any(Function),
    );
    expect(update).toHaveBeenCalledWith({ latitude: 16.8, longitude: 96.15 });
  });

  it('does not request permission again when automatic prompts were already tried', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(grantedPermission);
    jest.mocked(Location.watchPositionAsync).mockResolvedValue({ remove: jest.fn() });

    await watchCurrentCoordinates(jest.fn(), jest.fn(), false);

    expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reports denied permission without starting a location watch', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      ...grantedPermission,
      status: Location.PermissionStatus.DENIED,
      granted: false,
    });

    await expect(watchCurrentCoordinates(jest.fn(), jest.fn())).rejects.toMatchObject({
      code: 'LOCATION_PERMISSION_DENIED',
    });
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('allows subscription to be removed to prevent memory leaks', async () => {
    const update = jest.fn();
    const subscription = { remove: jest.fn() };
    const watch = jest.mocked(Location.watchPositionAsync);
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue(grantedPermission);
    watch.mockResolvedValue(subscription);

    const result = await watchCurrentCoordinates(update, jest.fn());
    result.remove();

    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });
});
