import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Copy, MapPin, Navigation, Route } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Notice } from '@/components/notice';
import { Page } from '@/components/page';
import { SectionHeading } from '@/components/section-heading';
import { useAppDatabase } from '@/contexts/app-database-context';
import { getPlaceByPcode } from '@/db/place-repository';
import { colors, radius, spacing } from '@/theme';
import type { PlaceRecord } from '@/types/pcode';
import { getCoordinateSourceDescription } from '@/utils/coordinate-source';

type DetailRow = { label: string; value: string | null };

function formatAdministrativeValue(name: string | null, pcode: string | null): string | null {
  if (!name) return pcode;
  return pcode ? `${name} · ${pcode}` : name;
}

export default function PlaceDetailScreen() {
  const { database, state: databaseState } = useAppDatabase();
  const { pcode, distanceKm } = useLocalSearchParams<{ pcode: string; distanceKm?: string }>();
  const [placeResult, setPlaceResult] = useState<{
    pcode: string;
    place: PlaceRecord | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (databaseState !== 'ready' || !database) {
      return;
    }
    let active = true;
    void getPlaceByPcode(database, pcode)
      .then((result) => {
        if (active) setPlaceResult({ pcode, place: result, error: null });
      })
      .catch(() => {
        if (active) {
          setPlaceResult({
            pcode,
            place: null,
            error: 'Place details could not be loaded from the local database.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [database, databaseState, pcode]);

  const currentResult = placeResult?.pcode === pcode ? placeResult : null;
  const place = currentResult?.place ?? null;
  const error = currentResult?.error ?? null;
  const loading = databaseState === 'loading' || (databaseState === 'ready' && !currentResult);

  const copyText = async (value: string) => Clipboard.setStringAsync(value);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.forest} />
        <AppText variant="small" muted>
          Loading place details
        </AppText>
      </View>
    );
  }

  if (error || !place) {
    return (
      <Page>
        <Notice
          title={databaseState === 'error' || error ? 'Place unavailable' : 'Place not found'}
          detail={error ?? (databaseState === 'error' ? 'The local place database could not be opened.' : 'This PCode is not in the installed dataset.')}
          tone="warning"
        />
        <ActionButton label="Search places" onPress={() => router.push('/search')} />
      </Page>
    );
  }

  const coordinateDescription = getCoordinateSourceDescription(place.coord_source);
  const rows: DetailRow[] = [
    { label: 'State / Region', value: formatAdministrativeValue(place.sr_name, place.sr_pcode) },
    { label: 'District', value: formatAdministrativeValue(place.district_name, place.district_pcode) },
    { label: 'Township', value: formatAdministrativeValue(place.tsp_name, place.tsp_pcode) },
    { label: 'Town', value: formatAdministrativeValue(place.town_name, place.town_pcode) },
    { label: 'Village tract', value: formatAdministrativeValue(place.vt_name, place.vt_pcode) },
    { label: 'Postal code', value: place.postal_code },
    {
      label: 'Distance from search point',
      value: distanceKm && Number.isFinite(Number(distanceKm)) ? `${Number(distanceKm).toFixed(1)} km` : null,
    },
  ];

  return (
    <Page>
      <View style={styles.titleBlock}>
        <View style={styles.typeTag}>
          <AppText variant="label" weight="bold" style={{ color: colors.forest }}>
            {place.type.replaceAll('_', ' ').toUpperCase()}
          </AppText>
        </View>
        {place.name_mmr ? (
          <AppText variant="title" weight="myanmar">
            {place.name_mmr}
          </AppText>
        ) : null}
        <AppText variant="display" weight="bold" style={{ fontSize: 30 }}>
          {place.name_eng ?? 'Unnamed place'}
        </AppText>
      </View>

      <View style={styles.codePanel}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="label" weight="bold" style={{ color: colors.lime }}>
            PCODE
          </AppText>
          <AppText variant="title" weight="semibold" style={{ color: colors.white }}>
            {place.pcode}
          </AppText>
        </View>
        <ActionButton label="Copy" icon={Copy} variant="secondary" onPress={() => void copyText(place.pcode)} />
      </View>

      <View style={styles.infoPanel}>
        <SectionHeading title="Administrative hierarchy" />
        {rows.filter((row) => row.value).map((row) => (
          <View key={row.label} style={styles.detailRow}>
            <AppText variant="small" muted>
              {row.label}
            </AppText>
            <AppText variant="small" weight="medium" style={styles.detailValue}>
              {row.value}
            </AppText>
          </View>
        ))}
      </View>

      {place.lat !== null && place.lng !== null ? (
        <View style={styles.infoPanel}>
          <SectionHeading title="Coordinates" />
          <AppText variant="body" weight="semibold">
            {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
          </AppText>
          {coordinateDescription ? (
            <Notice title={coordinateDescription.title} detail={coordinateDescription.detail} tone="neutral" />
          ) : (
            <Notice
              title="Coordinate source unavailable"
              detail="This location has coordinates but no source metadata. Accuracy cannot be confirmed."
              tone="warning"
              icon={MapPin}
            />
          )}
          <View style={styles.actions}>
            <ActionButton
              label="Copy coordinates"
              icon={Copy}
              onPress={() => void copyText(`${place.lat}, ${place.lng}`)}
            />
            <ActionButton
              label="Open on map"
              icon={Navigation}
              variant="primary"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/map',
                  params: { lat: String(place.lat), lng: String(place.lng), pcode: place.pcode },
                })
              }
            />
            <ActionButton
              label="Show route"
              icon={Route}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/map',
                  params: {
                    lat: String(place.lat),
                    lng: String(place.lng),
                    pcode: place.pcode,
                    route: '1',
                  },
                })
              }
            />
          </View>
        </View>
      ) : (
        <Notice title="No place coordinates" detail="This place has no coordinate in the dataset." />
      )}
    </Page>
  );
}

const styles = {
  loading: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  titleBlock: { gap: spacing.sm },
  typeTag: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
    backgroundColor: colors.limeSoft,
  },
  codePanel: {
    padding: spacing.lg,
    borderRadius: radius.panel,
    backgroundColor: colors.forest,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  infoPanel: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.panel, backgroundColor: colors.surface },
  detailRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: spacing.xs,
  },
  detailValue: { color: colors.ink },
  actions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
};