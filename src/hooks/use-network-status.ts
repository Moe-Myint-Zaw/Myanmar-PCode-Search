import { useEffect, useState } from 'react';

import { getIsOnline } from '@/services/network-service';

export function useNetworkStatus(): boolean | null {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const online = await getIsOnline();
        if (active) setIsOnline(online);
      } catch {
        if (active) setIsOnline(false);
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return isOnline;
}