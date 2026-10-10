import { router, useLocalSearchParams } from 'expo-router';
import { Crosshair, MapPinned, Navigation } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Notice } from '@/components/notice';
import { Page } from '@/components/page';
import { PlaceRow } from '@/components/place-row';
import { SectionHeading } from '@/components/section-heading';
import { useAppDatabase } from '@/contexts/app-database-context';
import { findNearbyPlaces } from '@/db/place-repository';
import { getCurrentCoordinates } from '@/services/location-service';
import { colors, radius, spacing, typography } from '@/theme';
import { AppError } from '@/types/errors';
import type { Coordinates, NearbyPlace } from '@/types/pcode';
import { parseCoordinates } from '@/utils/coordinates';

export default function NearbyScreen() {
  const { database, state: databaseState } = useAppDatabase();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const [coordinateText, setCoordinateText] = useState('');
  const [results, setResults] = useState<NearbyPlace[]>([]);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchAt = useCallback(async (coordinates: Coordinates) => {
    if (!database || databaseState !== 'ready') {
      setLocation(coordinates);
      setResults([]);
      setError('The place database is unavailable. You can still use the coordinate on the map.');
      setLoading(false);
      return;
    }
    setLocation(coordinates);
    setLoading(true);
    setError(null);
    try {
      setResults(await findNearbyPlaces(database, coordinates, 25));
    } catch {
      setResults([]);
      setError('Nearby search could not finish. Check the installed place dataset.');
    } finally {
      setLoading(false);
    }
  }, [database, databaseState]);

  const routeCoordinates =
    typeof params.lat === 'string' && typeof params.lng === 'string'
      ? parseCoordinates(`${params.lat},${params.lng}`)
      : null;
  const visibleCoordinateText = coordinateText || (routeCoordinates
    ? `${routeCoordinates.latitude}, ${routeCoordinates.longitude}`
    : '');

  useEffect(() => {
    if (typeof params.lat !== 'string' || typeof params.lng !== 'string') return;
    const coordinates = parseCoordinates(`${params.lat},${params.lng}`);
    if (!coordinates) return;

    let active = true;
    void Promise.resolve().then(() => {
      if (active) return searchAt(coordinates);
      return undefined;
    });
    return () => {
      active = false;
    };
  }, [params.lat, params.lng, searchAt]);

  const requestCurrentLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const coordinates = await getCurrentCoordinates();
      setCoordinateText(`${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`);
      await searchAt(coordinates);
    } catch (caught) {
      const message = caught instanceof AppError ? caught.message : 'Location is unavailable.';
      setError(message);
      setLoading(false);
    }
  };

  const submitCoordinates = () => {
    const coordinates = parseCoordinates(coordinateText);
    if (!coordinates) {
      setError('Enter valid latitude and longitude, for example 16.8661, 96.1951.');
      return;
    }
    void searchAt(coordinates);
  };

  return (
    <Page includeTopInset>
      <SectionHeading
        title="Places near you"
        detail="Coordinates are matched locally. No GPS data is uploaded."
      />
      {databaseState === 'error' ? (
        <Notice title="Nearby place lookup unavailable" detail="The local place database could not be opened." tone="warning" />
      ) : null}
      <ActionButton
        label="Use my location"
        icon={Navigation}
        onPress={() => void requestCurrentLocation()}
        loading={loading}
        variant="primary"
      />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="small" weight="semibold">
          Or enter coordinates
        </AppText>
        <TextInput
          value={visibleCoordinateText}
          onChangeText={setCoordinateText}
          placeholder="Latitude, longitude"
          placeholderTextColor={colors.muted}
          keyboardType="numbers-and-punctuation"
          returnKeyType="search"
          onSubmitEditing={submitCoordinates}
          accessibilityLabel="Latitude and longitude"
          style={styles.input}
        />
        <ActionButton label="Find nearby places" icon={Crosshair} onPress={submitCoordinates} />
      </View>
      <ActionButton
        label="Search an online landmark"
        icon={MapPinned}
        onPress={() => router.push('/landmark')}
        variant="quiet"
      />
      {error ? <Notice title="Location search needs attention" detail={error} tone="warning" /> : null}
      {location ? (
        <Notice
          title="Local coordinate search"
          detail={`${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} · within 25 km`}
          tone="neutral"
          icon={MapPinned}
        />
      ) : null}
      {loading ? <ActivityIndicator color={colors.forest} /> : null}
      {!loading && results.length === 0 && location ? (
        <Notice
          title="No nearby places found"
          detail="Try another coordinate or a larger-radius search from the map."
          tone="neutral"
        />
      ) : null}
      {results.length > 0 ? (
        <View style={styles.list}>
          <AppText variant="label" weight="bold" style={{ color: colors.forest }}>
            NEAREST MATCHES
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
  list: {
    borderRadius: radius.panel,
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
  },
};