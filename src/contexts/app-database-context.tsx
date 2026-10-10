import {
    importDatabaseFromAssetAsync,
    openDatabaseAsync,
    type SQLiteDatabase,
} from 'expo-sqlite';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { initializeDatabase } from '@/db/initialize';
import { DATABASE_NAME } from '@/db/schema';
import { AppError } from '@/types/errors';

const BUNDLED_DATABASE_ASSET = require('../../assets/database/myanmar_pcode.db') as number;

type AppDatabaseState = 'loading' | 'ready' | 'error';

type AppDatabaseContextValue = {
  database: SQLiteDatabase | null;
  state: AppDatabaseState;
  error: string | null;
  retryDatabaseSetup: () => void;
};

const AppDatabaseContext = createContext<AppDatabaseContextValue | null>(null);

async function openValidatedDatabase(): Promise<SQLiteDatabase> {
  let database: SQLiteDatabase | null = null;
  try {
    database = await openDatabaseAsync(DATABASE_NAME, { enableChangeListener: true });
    await initializeDatabase(database);
    return database;
  } catch (existingDatabaseError) {
    if (database) {
      await database.closeAsync();
      database = null;
    }

    try {
      await importDatabaseFromAssetAsync(DATABASE_NAME, {
        assetId: BUNDLED_DATABASE_ASSET,
        forceOverwrite: true,
      });
      database = await openDatabaseAsync(DATABASE_NAME, { enableChangeListener: true });
      await initializeDatabase(database);
      return database;
    } catch (bundledDatabaseError) {
      if (database) await database.closeAsync();
      const errorMessage = existingDatabaseError instanceof Error && existingDatabaseError.message.includes('permission')
        ? 'Storage permission is required for the place database. Check your device settings.'
        : 'The built-in place database could not be installed or verified. Reinstall the app to restore the bundled dataset.';
      throw new AppError(
        'DATABASE_CORRUPTED',
        errorMessage,
        { cause: new AggregateError([existingDatabaseError, bundledDatabaseError]) },
      );
    }
  }
}

export function AppDatabaseProvider({ children }: { children: React.ReactNode }) {
  const [database, setDatabase] = useState<SQLiteDatabase | null>(null);
  const [state, setState] = useState<AppDatabaseState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const databaseRef = useRef<SQLiteDatabase | null>(null);

  useEffect(() => {
    let active = true;
    const open = async () => {
      try {
        const openedDatabase = await openValidatedDatabase();
        if (active) {
          databaseRef.current = openedDatabase;
          setDatabase(openedDatabase);
          setState('ready');
        } else {
          await openedDatabase.closeAsync();
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'The built-in place database could not be initialized.',
          );
          setState('error');
        }
      }
    };

    void open();
    return () => {
      active = false;
      const current = databaseRef.current;
      databaseRef.current = null;
      if (current) void current.closeAsync();
    };
  }, [retryKey]);

  const retryDatabaseSetup = () => {
    setDatabase(null);
    setError(null);
    setState('loading');
    setRetryKey((value) => value + 1);
  };

  return (
    <AppDatabaseContext.Provider
      value={{ database, state, error, retryDatabaseSetup }}
    >
      {children}
    </AppDatabaseContext.Provider>
  );
}

export function useAppDatabase(): AppDatabaseContextValue {
  const value = useContext(AppDatabaseContext);
  if (!value) throw new Error('useAppDatabase must be used within AppDatabaseProvider.');
  return value;
}
