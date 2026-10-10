import { createContext, useContext, useEffect, useState } from 'react';

import { useAppDatabase } from '@/contexts/app-database-context';
import { getDatasetStatus } from '@/db/metadata';
import type { DatasetStatus } from '@/types/pcode';

type DatasetStatusContextValue = {
  status: DatasetStatus | null;
  error: string | null;
  refresh: () => Promise<void>;
};

const DatasetStatusContext = createContext<DatasetStatusContextValue | null>(null);

export function DatasetStatusProvider({ children }: { children: React.ReactNode }) {
  const { database, state: databaseState, error: databaseError } = useAppDatabase();
  const [status, setStatus] = useState<DatasetStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (databaseState !== 'ready' || !database) return;
    try {
      setStatus(await getDatasetStatus(database));
      setError(null);
    } catch {
      setStatus({ state: 'invalid', message: 'Database could not be read.' });
      setError('Database could not be read. Restart or reimport the dataset.');
    }
  };

  useEffect(() => {
    if (databaseState !== 'ready' || !database) return;
    let active = true;
    const load = async () => {
      try {
        const result = await getDatasetStatus(database);
        if (active) setStatus(result);
      } catch {
        if (active) {
          setStatus({ state: 'invalid', message: 'Database could not be read.' });
          setError('Database could not be read. Restart or reimport the dataset.');
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [database, databaseState]);

  const visibleStatus = databaseState === 'error'
    ? { state: 'invalid' as const, message: databaseError ?? 'Database unavailable.' }
    : status;
  const visibleError = databaseState === 'error' ? databaseError : error;

  return (
    <DatasetStatusContext.Provider value={{ status: visibleStatus, error: visibleError, refresh }}>
      {children}
    </DatasetStatusContext.Provider>
  );
}

export function useDatasetStatus(): DatasetStatusContextValue {
  const value = useContext(DatasetStatusContext);
  if (!value) throw new Error('useDatasetStatus must be used within DatasetStatusProvider.');
  return value;
}