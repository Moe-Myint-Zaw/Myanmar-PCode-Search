import { useIsFocused } from 'expo-router';
import { Download, Map, Pause, Play, RefreshCw, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Notice } from '@/components/notice';
import { Page } from '@/components/page';
import { SectionHeading } from '@/components/section-heading';
import { useAppDatabase } from '@/contexts/app-database-context';
import { getStateRegionMapBounds } from '@/db/place-repository';
import { useNetworkStatus } from '@/hooks/use-network-status';
import {
    createStateRegionOfflineRegions,
    estimateOfflineTileCount,
    isEquivalentOfflineRegion,
    MAP_OFFLINE_DOWNLOADS_ENABLED,
    MAP_STYLE_URL,
    MAX_OFFLINE_TILE_COUNT,
    type OfflineRegion,
} from '@/map/map-config';
import {
    createOfflinePack,
    deleteOfflinePack,
    listOfflinePacks,
    setOfflinePackPaused,
    updateOfflinePack,
    type OfflinePackSummary,
} from '@/map/offline-map-service';
import { colors, radius, spacing, typography } from '@/theme';
import { AppError } from '@/types/errors';

export default function OfflineMapsScreen() {
  const { database, state: databaseState } = useAppDatabase();
  const isFocused = useIsFocused();
  const online = useNetworkStatus();
  const [regions, setRegions] = useState<OfflineRegion[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [packs, setPacks] = useState<OfflinePackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
    const [boundsText, setBoundsText] = useState('');
    const [minZoom, setMinZoom] = useState('10');
    const [maxZoom, setMaxZoom] = useState('15');
    const customBoundsValues = boundsText.split(',').map((value) => Number(value.trim()));
    const customMinimumZoom = Number(minZoom);
    const customMaximumZoom = Number(maxZoom);
    const customEstimate =
      customBoundsValues.length === 4 &&
      customBoundsValues.every(Number.isFinite) &&
      customBoundsValues[0] < customBoundsValues[2] &&
      customBoundsValues[1] < customBoundsValues[3] &&
      customMinimumZoom >= 0 &&
      customMaximumZoom <= 22 &&
      Number.isInteger(customMinimumZoom) &&
      Number.isInteger(customMaximumZoom) &&
      customMinimumZoom <= customMaximumZoom
        ? estimateOfflineTileCount({
            id: 'custom-preview',
            name: 'Custom preview',
            bounds: [customBoundsValues[0], customBoundsValues[1], customBoundsValues[2], customBoundsValues[3]],
            minZoom: customMinimumZoom,
            maxZoom: customMaximumZoom,
          })
        : null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFocused || databaseState !== 'ready' || !database) return;

    let active = true;
    void getStateRegionMapBounds(database)
      .then((stateRegions) => {
        if (active) {
          setRegions(createStateRegionOfflineRegions(stateRegions));
          setRegionsError(null);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setRegions([]);
          setRegionsError(
            caught instanceof Error
              ? caught.message
              : 'State/Region map areas could not be loaded from the place database.',
          );
        }
      })
      .finally(() => {
        if (active) setRegionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [database, databaseState, isFocused]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPacks(await listOfflinePacks());
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof AppError
          ? caught.message
          : 'Map storage could not be read in this runtime.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    const loadPacks = async () => {
      try {
        const result = await listOfflinePacks();
        if (active) {
          setPacks(result);
          setError(null);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof AppError
              ? caught.message
              : 'Map storage could not be read in this runtime.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPacks();
    return () => {
      active = false;
    };
  }, [isFocused]);

  const beginDownload = async (region: OfflineRegion) => {
    if (packs.some((pack) => isEquivalentOfflineRegion(region, pack))) {
      setError('An offline pack with the same bounds and zoom range is already on this device.');
      return;
    }
    setActiveRegion(region.id);
    setError(null);
    try {
      const pack = await createOfflinePack(
        region,
        (progress) => setPacks((current) => [
          progress,
          ...current.filter((item) => item.id !== progress.id),
        ]),
        (packError) => setError(packError.message),
      );
      setPacks((current) => [pack, ...current.filter((item) => item.id !== pack.id)]);
    } catch (caught) {
      const message = caught instanceof AppError ? caught.message : 'The map area could not be downloaded.';
      setError(message);
    } finally {
      setActiveRegion(null);
      void refresh();
    }
  };

  const downloadCustomBounds = () => {
    // Input length validation to prevent excessive input
    if (boundsText.length > 200) {
      setError('Bounds input is too long. Use the format: west, south, east, north');
      return;
    }

    const bounds = boundsText.split(',').map((value) => Number(value.trim()));
    const minimum = Number(minZoom);
    const maximum = Number(maxZoom);

    // Comprehensive bounds validation
    if (
      bounds.length !== 4 ||
      bounds.some((value) => !Number.isFinite(value)) ||
      bounds[0] < -180 || bounds[2] > 180 || bounds[0] >= bounds[2] ||
      bounds[1] < -90 || bounds[3] > 90 || bounds[1] >= bounds[3] ||
      !Number.isInteger(minimum) || !Number.isInteger(maximum) ||
      minimum < 0 || maximum > 22 || minimum > maximum
    ) {
      setError('Bounds must be west, south, east, north in valid longitude/latitude ranges; zooms must be whole numbers from 0 to 22.');
      return;
    }

    // Calculate area to prevent extremely large downloads
    const latRange = bounds[3] - bounds[1];
    const lonRange = bounds[2] - bounds[0];
    const areaDegrees = latRange * lonRange;
    const MAX_AREA_DEGREES = 50; // Approximately 5,500 km² at the equator

    if (areaDegrees > MAX_AREA_DEGREES) {
      setError('The requested area is too large. Reduce the bounds to a smaller region.');
      return;
    }

    const region: OfflineRegion = {
      id: 'custom-bounds',
      name: 'Custom map area',
      bounds: [bounds[0], bounds[1], bounds[2], bounds[3]],
      minZoom: minimum,
      maxZoom: maximum,
    };
    const estimate = estimateOfflineTileCount(region);
    if (estimate > MAX_OFFLINE_TILE_COUNT) {
      setError(
        `This custom area is estimated at ${estimate.toLocaleString()} tiles; the per-device limit is ${MAX_OFFLINE_TILE_COUNT.toLocaleString()}. Reduce the area or zoom range.`,
      );
      return;
    }
    void beginDownload(region);
  };

  const togglePack = async (pack: OfflinePackSummary) => {
    try {
      await setOfflinePackPaused(pack.id, pack.state === 'active');
      await refresh();
    } catch {
      setError('The map download state could not be changed.');
    }
  };

  const updatePack = async (packId: string) => {
    if (!online) {
      setError('Connect to the internet before updating an offline map area.');
      return;
    }
    try {
      await updateOfflinePack(packId);
      await refresh();
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : 'The map area could not be updated.');
    }
  };

  const removePack = (pack: OfflinePackSummary) => {
    Alert.alert('Delete offline area?', `${pack.name} will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteOfflinePack(pack.id).then(refresh).catch(() => {
            setError('The offline area could not be deleted.');
          });
        },
      },
    ]);
  };

  return (
    <Page>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView>
          <SectionHeading
            title="Offline maps"
            detail="Download only the areas you need. PCode search data is stored separately."
          />
          {!MAP_OFFLINE_DOWNLOADS_ENABLED ? (
        <Notice
          title="Offline downloads disabled"
          detail="This custom map provider is available online. Review its offline-download terms, then enable downloads with EXPO_PUBLIC_MAP_OFFLINE_DOWNLOADS_ENABLED=true."
          tone="warning"
          icon={Map}
        />
      ) : null}
      {online === false ? (
        <Notice
          title="Map downloads unavailable offline"
          detail="Downloaded packs remain usable. Connect to update or download a map area."
          tone="warning"
        />
      ) : null}
      {error ? <Notice title="Map storage needs attention" detail={error} tone="danger" /> : null}

      <View style={styles.section}>
        <SectionHeading
          title="Available areas"
          detail={
            MAP_OFFLINE_DOWNLOADS_ENABLED
              ? 'State/Region bounds are estimated from place coordinates. Download areas individually.'
              : 'Downloads are disabled until offline use is approved for this provider.'
          }
        />
        {regionsLoading && databaseState !== 'error' ? (
          <ActivityIndicator color={colors.forest} />
        ) : null}
        {databaseState === 'error' ? (
          <Notice
            title="State/Region areas unavailable"
            detail="The place database is unavailable, so map areas could not be loaded."
            tone="warning"
          />
        ) : null}
        {regionsError ? (
          <Notice title="State/Region areas unavailable" detail={regionsError} tone="warning" />
        ) : null}
        {!regionsLoading && !regionsError && regions.length === 0 ? (
          <Notice
            title="No State/Region areas found"
            detail="The installed place database does not contain State/Region records."
            tone="neutral"
          />
        ) : null}
        {regions.map((region) => {
          const isInstalled = packs.some((pack) => isEquivalentOfflineRegion(region, pack));
          const isBusy = activeRegion === region.id;
          const estimatedTiles = estimateOfflineTileCount(region);
          return (
            <View key={region.id} style={styles.region}>
              <View style={styles.regionIcon}>
                <Map size={19} color={colors.forest} />
              </View>
              <View style={styles.regionCopy}>
                <AppText variant="body" weight="semibold">
                  {region.name}
                </AppText>
                <AppText variant="small" muted>
                  {region.coordinateCount?.toLocaleString()} coordinate-bearing places · zoom{' '}
                  {region.minZoom}–{region.maxZoom} · approx. {estimatedTiles.toLocaleString()} tiles
                </AppText>
                {estimatedTiles > MAX_OFFLINE_TILE_COUNT ? (
                  <AppText variant="small" muted>
                    Exceeds the {MAX_OFFLINE_TILE_COUNT.toLocaleString()}-tile device limit.
                  </AppText>
                ) : null}
              </View>
              <ActionButton
                label={isInstalled ? 'Added' : isBusy ? 'Downloading' : 'Download'}
                icon={Download}
                disabled={
                  isInstalled ||
                  estimatedTiles > MAX_OFFLINE_TILE_COUNT ||
                  regionsLoading ||
                  !MAP_OFFLINE_DOWNLOADS_ENABLED ||
                  !MAP_STYLE_URL ||
                  online === false ||
                  Boolean(activeRegion)
                }
                loading={isBusy}
                onPress={() => void beginDownload(region)}
                variant={isInstalled ? 'quiet' : 'secondary'}
                accessibilityLabel={`Download ${region.name} map area`}
              />
            </View>
          );
        })}
        <View style={styles.customArea}>
          <AppText variant="body" weight="semibold">
            Custom bounding box
          </AppText>
          <AppText variant="small" muted>
            Enter west, south, east, north coordinates.
          </AppText>
          <TextInput
            value={boundsText}
            onChangeText={setBoundsText}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Map bounds west, south, east, north"
            style={styles.input}
          />
          <AppText variant="small" muted>
            {customEstimate === null
              ? `Enter valid bounds and zooms. Per-device limit: ${MAX_OFFLINE_TILE_COUNT.toLocaleString()} tiles.`
              : `Approx. ${customEstimate.toLocaleString()} tiles · device limit ${MAX_OFFLINE_TILE_COUNT.toLocaleString()}`}
          </AppText>
          <View style={styles.zoomInputs}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="small" muted>Minimum zoom</AppText>
              <TextInput
                value={minZoom}
                onChangeText={setMinZoom}
                keyboardType="number-pad"
                accessibilityLabel="Minimum map zoom"
                style={styles.zoomInput}
              />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="small" muted>Maximum zoom</AppText>
              <TextInput
                value={maxZoom}
                onChangeText={setMaxZoom}
                keyboardType="number-pad"
                accessibilityLabel="Maximum map zoom"
                style={styles.zoomInput}
              />
            </View>
          </View>
          <ActionButton
            label="Download custom area"
            icon={Download}
            disabled={
              !MAP_OFFLINE_DOWNLOADS_ENABLED ||
              !MAP_STYLE_URL ||
              online === false ||
              Boolean(activeRegion)
            }
            loading={activeRegion?.startsWith('custom-') ?? false}
            onPress={downloadCustomBounds}
            variant="secondary"
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="On this device" detail="Downloaded packs stay available after restart." />
        {loading ? <ActivityIndicator color={colors.forest} /> : null}
        {!loading && packs.length === 0 ? (
          <View style={styles.empty}>
            <Map size={22} color={colors.muted} />
            <AppText variant="small" muted>
              No offline areas yet
            </AppText>
          </View>
        ) : null}
        {packs.map((pack) => (
          <View key={pack.id} style={styles.pack}>
            <View style={styles.packTop}>
              <View style={styles.packCopy}>
                <AppText variant="body" weight="semibold">
                  {pack.name}
                </AppText>
                <AppText variant="small" muted>
                  {pack.state === 'complete'
                    ? `Ready offline · ${(pack.completedBytes / (1024 * 1024)).toFixed(1)} MB stored`
                    : `${pack.state === 'active' ? 'Downloading' : pack.state === 'inactive' ? 'Paused' : 'Complete'} · ${Math.round(pack.percentage)}%`}
                </AppText>
                {pack.lastUpdatedAt ? (
                  <AppText variant="small" muted>
                    Updated {new Date(pack.lastUpdatedAt).toLocaleString()}
                  </AppText>
                ) : null}
              </View>
              {pack.state !== 'complete' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={pack.state === 'active' ? `Pause ${pack.name} download` : `Resume ${pack.name} download`}
                  accessibilityHint={pack.state === 'active' ? 'Pauses the map download' : 'Resumes the paused map download'}
                  onPress={() => void togglePack(pack)}
                  style={styles.iconButton}
                >
                  {pack.state === 'active' ? <Pause size={17} color={colors.ink} /> : <Play size={17} color={colors.ink} />}
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Update ${pack.name}`}
                accessibilityHint="Refreshes the map tiles for this area"
                disabled={!MAP_OFFLINE_DOWNLOADS_ENABLED || !online}
                onPress={() => void updatePack(pack.id)}
                style={styles.iconButton}
              >
                <RefreshCw size={17} color={colors.forest} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${pack.name}`}
                accessibilityHint="Removes this map area from the device"
                onPress={() => removePack(pack)}
                style={styles.iconButton}
              >
                <Trash2 size={17} color={colors.coral} />
              </Pressable>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(pack.percentage) }}
              style={styles.progressTrack}
            >
              <View style={[styles.progress, { width: `${Math.max(0, Math.min(100, pack.percentage))}%` }]} />
            </View>
          </View>
        ))}
        <ActionButton label="Refresh map storage" onPress={() => void refresh()} variant="quiet" />
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  region: {
    minHeight: 82,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.panel,
    backgroundColor: colors.surface,
  },
  regionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.limeSoft,
  },
  regionCopy: { flex: 1, minWidth: 100, gap: 3 },
    customArea: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.panel, backgroundColor: colors.surface },
    input: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.control,
      backgroundColor: colors.background,
      color: colors.ink,
      fontFamily: typography.regular,
      fontSize: 15,
    },
    zoomInputs: { flexDirection: 'row', gap: spacing.md },
    zoomInput: {
      minHeight: 46,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.control,
      backgroundColor: colors.background,
      color: colors.ink,
      fontFamily: typography.regular,
      fontSize: 15,
    },
  empty: {
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.panel,
    backgroundColor: colors.surface,
  },
  pack: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.panel, backgroundColor: colors.surface },
  packTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  packCopy: { flex: 1, minWidth: 0, gap: 3 },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.background,
  },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: radius.capsule, backgroundColor: colors.surfaceMuted },
  progress: { height: 5, borderRadius: radius.capsule, backgroundColor: colors.forest },
});