import { router } from 'expo-router';
import { Globe2, MapPin, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Notice } from '@/components/notice';
import { Page } from '@/components/page';
import { PlaceRow } from '@/components/place-row';
import { SectionHeading } from '@/components/section-heading';
import { useAppDatabase } from '@/contexts/app-database-context';
import { findNearbyPlaces } from '@/db/place-repository';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { geocodeLandmark } from '@/services/geocoding-service';
import { colors, radius, spacing, typography } from '@/theme';
import type { NearbyPlace } from '@/types/pcode';

export default function LandmarkScreen() {
  const { database, state: databaseState } = useAppDatabase();
  const online = useNetworkStatus();
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState<string | null>(null);
  const [results, setResults] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!online) {
      setError('External landmark search is unavailable offline. Search local place names or enter coordinates instead.');
      return;
    }
    setLoading(true);
    setError(null);
    setLabel(null);
    try {
      if (!database || databaseState !== 'ready') {
        throw new Error('The local place database is unavailable. Open Settings to check its status.');
      }
      const landmark = await geocodeLandmark(query);
      setLabel(landmark.label);
      setResults(await findNearbyPlaces(database, landmark, 25));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Landmark search is unavailable.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <SectionHeading
        title="Find a landmark"
        detail="This explicit online search looks up a landmark, then matches it to the local place database."
      />
      <View style={{ gap: spacing.sm }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Landmark, address, or locality"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          onSubmitEditing={() => void search()}
          accessibilityLabel="Landmark or address"
          style={styles.input}
        />
        <ActionButton
          label="Search online"
          icon={Search}
          onPress={() => void search()}
          loading={loading}
          disabled={!query.trim() || online === false}
          variant="primary"
        />
      </View>
      {online === false ? (
        <Notice
          title="Landmark search unavailable offline"
          detail="Manual place search and coordinate parsing remain available without a connection."
          tone="warning"
          icon={Globe2}
        />
      ) : null}
      {error ? <Notice title="Landmark search could not finish" detail={error} tone="danger" /> : null}
      {loading ? <ActivityIndicator color={colors.forest} /> : null}
      {label ? <Notice title="Online landmark match" detail={label} tone="neutral" icon={MapPin} /> : null}
      {!loading && label && results.length === 0 ? (
        <Notice
          title="No local PCode match nearby"
          detail="The landmark was located, but the installed dataset has no coordinate-bearing place within 25 km."
          tone="warning"
        />
      ) : null}
      {results.length > 0 ? (
        <View style={styles.list}>
          <AppText variant="label" weight="bold" style={{ color: colors.forest }}>
            LOCAL PCODE MATCHES
          </AppText>
          {results.map((place) => (
            <PlaceRow
              key={place.pcode}
              place={place}
              onPress={() =>
                router.push({
                  pathname: '/place/[pcode]',
                  params: { pcode: place.pcode, distanceKm: String(place.distance_km) },
                })
              }
            />
          ))}
        </View>
      ) : null}
      <AppText variant="small" muted>
        Geocoding by OpenStreetMap Nominatim. Landmark text is sent only when you tap Search online; GPS matching stays on-device.
      </AppText>
    </Page>
  );
}

const styles = {
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.regular,
    fontSize: 16,
  },
  list: { borderRadius: radius.panel, backgroundColor: colors.surface, paddingTop: spacing.md },
};