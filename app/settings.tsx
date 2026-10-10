import { router } from 'expo-router';
import { Database, Download, Info, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Notice } from '@/components/notice';
import { Page } from '@/components/page';
import { SectionHeading } from '@/components/section-heading';
import { useAppDatabase } from '@/contexts/app-database-context';
import { useDatasetStatus } from '@/contexts/dataset-status-context';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { updateDatasetFromUrl } from '@/services/dataset-update-service';
import { colors, spacing } from '@/theme';
import { AppError } from '@/types/errors';

const DATASET_UPDATE_URL = process.env.EXPO_PUBLIC_DATASET_UPDATE_URL?.trim() ?? '';

export default function SettingsScreen() {
  const {
    database,
    state: databaseState,
    retryDatabaseSetup,
  } = useAppDatabase();
  const { status, refresh } = useDatasetStatus();
  const online = useNetworkStatus();
  const [busy, setBusy] = useState<'update' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateDataset = async () => {
    if (!database || databaseState !== 'ready') {
      setError('The built-in place database is unavailable. Restore it before updating.');
      return;
    }
    if (!online) {
      setError('A network connection is required to download a dataset update.');
      return;
    }

    setBusy('update');
    setError(null);
    setMessage(null);
    const controller = new AbortController();
    try {
      const updateResult = await updateDatasetFromUrl(
        database,
        DATASET_UPDATE_URL,
        controller.signal,
      );
      if (updateResult === 'updated') await refresh();
      setMessage(
        updateResult === 'updated'
          ? 'Dataset update verified and installed.'
          : 'The installed dataset is already current.',
      );
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : 'The dataset update did not complete.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page>
      <SectionHeading
        title="Built-in place database"
        detail="Place data ships with the app and is available offline. Map downloads use separate storage."
      />

      {status?.state === 'ready' ? (
        <Notice
          title={`Dataset ${status.metadata.datasetVersion} · ${status.metadata.recordCount.toLocaleString()} places`}
          detail={`${status.origin === 'bundled' ? 'Included with app' : status.origin === 'update' ? 'Validated update' : 'Installed dataset'} · Source: ${status.metadata.source}${status.installedAt ? ` · Installed ${new Date(status.installedAt).toLocaleDateString()}` : ''}${status.updatedAt ? ` · Updated ${new Date(status.updatedAt).toLocaleDateString()}` : ''}`}
          tone="success"
          icon={Database}
        />
      ) : status?.state === 'missing' ? (
        <Notice
          title="Built-in place dataset unavailable"
          detail="Restore the database packaged with this app to use offline place search."
          tone="warning"
          icon={Database}
        />
      ) : status?.state === 'invalid' ? (
        <Notice title="Dataset validation failed" detail={status.message} tone="danger" />
      ) : (
        <ActivityIndicator color={colors.forest} />
      )}

      {message ? <Notice title="Dataset ready" detail={message} tone="success" /> : null}
      {error ? <Notice title="Dataset action failed" detail={error} tone="danger" /> : null}
      {databaseState === 'error' ? (
        <ActionButton
          label="Retry built-in database setup"
          icon={Database}
          onPress={retryDatabaseSetup}
          disabled={busy !== null}
          variant="secondary"
        />
      ) : null}

      {DATASET_UPDATE_URL ? (
        <View style={styles.section}>
          <SectionHeading
            title="Optional dataset update"
            detail="The built-in dataset remains available if an update fails."
          />
          <ActionButton
            label="Check and install update"
            icon={RefreshCw}
            onPress={() => void updateDataset()}
            loading={busy === 'update'}
            disabled={busy !== null || online === false}
            variant="secondary"
          />
          {online === false ? (
            <Notice
              title="Offline"
              detail="The built-in place database is ready. Optional updates need an active connection."
              tone="warning"
            />
          ) : null}
        </View>
      ) : (
        <AppText variant="small" muted>
          The bundled dataset remains available offline without update configuration.
        </AppText>
      )}

      <View style={styles.section}>
        <SectionHeading title="Map storage" detail="Offline map packs do not affect local place search." />
        <ActionButton
          label="Manage offline map areas"
          icon={Download}
          onPress={() => router.push('/offline/maps')}
        />
      </View>
      <ActionButton label="About and data provenance" icon={Info} onPress={() => router.push('/about')} variant="quiet" />
      <AppText variant="small" muted>
        GPS coordinates are used on-device for nearby search. External landmark lookup is an explicit online-only action.
      </AppText>
    </Page>
  );
}

const styles = {
  section: { gap: spacing.md },
};