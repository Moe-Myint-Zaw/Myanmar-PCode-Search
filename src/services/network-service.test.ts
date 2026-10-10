import * as Network from 'expo-network';

import { getIsOnline } from './network-service';

jest.mock('expo-network', () => ({
  ...jest.requireActual<typeof import('expo-network')>('expo-network'),
  getNetworkStateAsync: jest.fn(),
}));

describe('getIsOnline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when connected and internet is reachable', async () => {
    jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: Network.NetworkStateType.WIFI,
    });

    await expect(getIsOnline()).resolves.toBe(true);
  });

  it('returns true when connected and internet reachability is unknown', async () => {
    jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
      isConnected: true,
      isInternetReachable: undefined,
      type: Network.NetworkStateType.WIFI,
    });

    await expect(getIsOnline()).resolves.toBe(true);
  });

  it('returns false when not connected', async () => {
    jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
      type: Network.NetworkStateType.NONE,
    });

    await expect(getIsOnline()).resolves.toBe(false);
  });

  it('returns false when internet is explicitly unreachable', async () => {
    jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
      isConnected: true,
      isInternetReachable: false,
      type: Network.NetworkStateType.CELLULAR,
    });

    await expect(getIsOnline()).resolves.toBe(false);
  });
});
