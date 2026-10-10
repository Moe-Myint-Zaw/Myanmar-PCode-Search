import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Notice } from '@/components/notice';
import { PlaceRow } from '@/components/place-row';
import { PlaceTypeFilterControl } from '@/components/place-type-filter';
import { SearchField } from '@/components/search-field';
import { useAppDatabase } from '@/contexts/app-database-context';
import { findNearbyPlaces, searchPlaces } from '@/db/place-repository';
import { colors, radius, spacing } from '@/theme';
import type { PlaceRecord, PlaceTypeFilter } from '@/types/pcode';
import { parseCoordinates } from '@/utils/coordinates';

const SEARCH_DEBOUNCE_MS = 160;

export function PlaceSearchPanel({
  compact = false,
  initialValue = '',
}: {
  compact?: boolean;
  initialValue?: string;
}) {
  const { database, state: databaseState } = useAppDatabase();
  const [query, setQuery] = useState(initialValue);
  const [placeType, setPlaceType] = useState<PlaceTypeFilter>('all');
  const [snapshot, setSnapshot] = useState<{
    key: string;
    results: PlaceRecord[];
    error: string | null;
  } | null>(null);
  const trimmedQuery = query.trim();
  const resultKey = `${placeType}:${trimmedQuery}`;
  const currentSnapshot = snapshot?.key === resultKey ? snapshot : null;
  const results = currentSnapshot?.results ?? [];
  const error = currentSnapshot?.error ?? null;
  const loading =
    databaseState === 'ready' && trimmedQuery.length > 0 && currentSnapshot === null;

  useEffect(() => {
    if (databaseState !== 'ready' || !database || !trimmedQuery) return;

    let active = true;
    const timer = setTimeout(() => {
      const coordinates = parseCoordinates(trimmedQuery);
      const search = coordinates
        ? findNearbyPlaces(database, coordinates, 25)
        : searchPlaces(database, trimmedQuery, placeType);

      void search
        .then((places) => {
          if (active) setSnapshot({ key: resultKey, results: places, error: null });
        })
        .catch(() => {
          if (active) {
            setSnapshot({
              key: resultKey,
              results: [],
              error: 'Search is unavailable. Check the installed dataset and try again.',
            });
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [database, databaseState, placeType, resultKey, trimmedQuery]);

  const visibleResults = compact ? results.slice(0, 4) : results;

  const openPlace = (place: PlaceRecord & { distance_km?: number }) => {
    router.push({
      pathname: '/place/[pcode]',
      params: {
        pcode: place.pcode,
        ...(place.distance_km === undefined ? {} : { distanceKm: String(place.distance_km) }),
      },
    });
  };

  return (
    <View style={{ gap: spacing.md }}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder="Place, PCode, postal code, or coordinates"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Search English or Myanmar names, PCodes, postal codes, or coordinates"
        editable={databaseState === 'ready'}
      />
      <PlaceTypeFilterControl value={placeType} onChange={setPlaceType} />
      {databaseState === 'loading' ? (
        <Notice title="Preparing local search" detail="Opening the place database." tone="neutral" />
      ) : null}
      {databaseState === 'error' ? (
        <Notice
          title="Local search unavailable"
          detail="The database could not be initialized. Map and offline-map management remain separate."
          tone="danger"
        />
      ) : null}
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <ActivityIndicator color={colors.forest} size="small" />
          <AppText variant="small" muted>
            Searching local places
          </AppText>
        </View>
      ) : null}
      {error ? <Notice title="Search could not finish" detail={error} tone="danger" /> : null}
      {databaseState === 'ready' && !loading && !error && query.trim() && results.length === 0 ? (
        <View
          style={{
            padding: spacing.lg,
            alignItems: 'center',
            gap: spacing.sm,
            borderRadius: radius.panel,
            backgroundColor: colors.surface,
          }}
        >
          <AppText variant="body" weight="semibold">
            No matching places
          </AppText>
          <AppText variant="small" muted style={{ textAlign: 'center' }}>
            Try another spelling, a full PCode, postal code, or a coordinate pair.
          </AppText>
        </View>
      ) : null}
      {visibleResults.length > 0 ? (
        <View style={{ borderRadius: radius.panel, backgroundColor: colors.surface }}>
          {visibleResults.map((place) => (
            <PlaceRow
              key={place.pcode}
              place={place}
              onPress={() => openPlace(place)}
            />
          ))}
        </View>
      ) : null}
      {compact && results.length > visibleResults.length ? (
        <ActionButton
          label={`View all ${results.length} matches`}
          onPress={() => router.push({ pathname: '/search', params: { q: query } })}
          variant="quiet"
        />
      ) : null}
      {compact && results.length === 0 && query.trim().length === 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {['Yangon', 'PCode', 'Postal code', 'Myanmar name'].map((label) => (
            <View key={label} style={styles.hint}>
              <AppText variant="small" muted>
                {label}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  hint: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.control,
  },
};