import type * as Location from 'expo-location';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { MapPin, MapPinned, Wifi, WifiOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { DatasetStatusNotice } from '@/components/dataset-status';
import { MapSurface, type MapPinKind } from '@/components/map-surface';
import { Notice } from '@/components/notice';
import { Page } from '@/components/page';
import { SectionHeading } from '@/components/section-heading';
import { useAppDatabase } from '@/contexts/app-database-context';
import { findNearbyPlaces, getPlaceByPcode } from '@/db/place-repository';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { getOfflineCoverageState, isViewportCovered } from '@/map/coverage';
import { MAP_OFFLINE_DOWNLOADS_ENABLED, MAP_STYLE_URL } from '@/map/map-config';
import { listOfflinePacks, setMapNetworkEnabled, type OfflinePackSummary } from '@/map/offline-map-service';
import { getCurrentCoordinates, watchCurrentCoordinates } from '@/services/location-service';
import { colors, radius, spacing } from '@/theme';
import { AppError } from '@/types/errors';
import type { Coordinates, PlaceRecord } from '@/types/pcode';
import { parseCoordinates } from '@/utils/coordinates';

const MYANMAR_CENTER: Coordinates = { latitude: 19.5, longitude: 96.1 };

export default function MapScreen() {
  const params = useLocalSearchParams<{ lat?: string; lng?: string; pcode?: string }>();
  const { database, state: databaseState } = useAppDatabase();
  const isFocused = useIsFocused();
  const online = useNetworkStatus();
  const routePoint =
    typeof params.lat === 'string' && typeof params.lng === 'string'
      ? parseCoordinates(`${params.lat},${params.lng}`)
      : null;
  const [packs, setPacks] = useState<OfflinePackSummary[]>([]);
  const [viewport, setViewport] = useState<[number, number, number, number] | null>(null);
  const [packLoading, setPackLoading] = useState(true);
  const [packError, setPackError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<Coordinates | null>(null);
  const [gpsCenter, setGpsCenter] = useState<Coordinates | null>(null);
  const [locationWatchRetry, setLocationWatchRetry] = useState(0);
  const locationPermissionRequested = useRef(false);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceRecord | null>(null);
  const [placeLookupLoading, setPlaceLookupLoading] = useState(false);
  const [placeLookupError, setPlaceLookupError] = useState<string | null>(null);
  const center = gpsCenter ?? routePoint ?? MYANMAR_CENTER;
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!isFocused) return;

    isMountedRef.current = true;
    let subscription: Location.LocationSubscription | null = null;
    let hasCenteredOnLocation = false;
    const requestPermission = !locationPermissionRequested.current;
    locationPermissionRequested.current = true;

    const updateLocation = (point: Coordinates) => {
      if (!isMountedRef.current) return;
      setGpsLocation(point);
      setLocationError(null);
      if (!hasCenteredOnLocation) {
        hasCenteredOnLocation = true;
        setGpsCenter(point);
      }
    };

    void getCurrentCoordinates(requestPermission)
      .then((point) => {
        if (!isMountedRef.current) return null;
        updateLocation(point);
        return watchCurrentCoordinates(updateLocation, (error) => {
          if (isMountedRef.current) setLocationError(error.message);
        }, false);
      })
      .then((result) => {
        if (!result) return;
        if (isMountedRef.current) subscription = result;
        else result.remove();
      })
      .catch((error: unknown) => {
        if (!isMountedRef.current) return;
        setLocationError(
          error instanceof AppError
            ? error.message
            : 'GPS location is unavailable. Try again or enter coordinates in Nearby.',
        );
      });

    return () => {
      isMountedRef.current = false;
      subscription?.remove();
    };
  }, [isFocused, locationWatchRetry]);

  useEffect(() => {
    setMapNetworkEnabled(online === true && !offlineOnly);
  }, [offlineOnly, online]);

  useEffect(() => {
    if (!isFocused) return;
    isMountedRef.current = true;
    void listOfflinePacks()
      .then((result) => {
        if (isMountedRef.current) {
          setPacks(result);
          setPackError(null);
        }
      })
      .catch((error: unknown) => {
        if (isMountedRef.current) {
          setPackError(
            error instanceof AppError
              ? error.message
              : 'Map storage could not be read in this runtime.',
          );
        }
      })
      .finally(() => {
        if (isMountedRef.current) setPackLoading(false);
      });
    return () => {
      isMountedRef.current = false;
    };
  }, [isFocused]);

  const centerCoverage = getOfflineCoverageState(center, packs);
  const viewportCovered = viewport
    ? packs.some((pack) => pack.state === 'complete' && isViewportCovered(viewport, pack.bounds))
    : centerCoverage === 'available';

  const openNearbySearch = (point: Coordinates) => {
    router.push({
      pathname: '/(tabs)/nearby',
      params: { lat: String(point.latitude), lng: String(point.longitude) },
    });
  };

  const openPlaceDetails = (place: PlaceRecord) => {
    router.push({
      pathname: '/place/[pcode]',
      params: {
        pcode: place.pcode,
        ...('distance_km' in place ? { distanceKm: String(place.distance_km) } : {}),
      },
    });
  };

  const selectMapPin = async (coordinates: Coordinates, kind: MapPinKind) => {
    setSelectedPlace(null);
    setPlaceLookupError(null);
    if (!database || databaseState !== 'ready') {
      setPlaceLookupError('The local place database is unavailable.');
      return;
    }

    setPlaceLookupLoading(true);
    try {
      const place =
        kind === 'place' && typeof params.pcode === 'string'
          ? await getPlaceByPcode(database, params.pcode)
          : (await findNearbyPlaces(database, coordinates, 25, 1))[0] ?? null;
      if (!place) {
        if (isMountedRef.current) {
          setPlaceLookupError('No place was found near this map pin.');
        }
        return;
      }
      if (isMountedRef.current) {
        setSelectedPlace(place);
      }
    } catch {
      if (isMountedRef.current) {
        setPlaceLookupError('Place details could not be loaded from the local database.');
      }
    } finally {
      if (isMountedRef.current) {
        setPlaceLookupLoading(false);
      }
    }
  };

  const requestCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const point = await getCurrentCoordinates();
      setGpsLocation(point);
      setGpsCenter(point);
      setLocationWatchRetry((retry) => retry + 1);
    } catch (caught) {
      setLocationError(
        caught instanceof AppError
          ? caught.message
          : 'GPS location is unavailable. Try again or enter coordinates in Nearby.',
      );
    } finally {
      setLocationLoading(false);
    }
  };

  return (
    <Page includeTopInset>
      <SectionHeading
        title="Map"
        detail="Your live location appears as a red pin while the map is open. Map tiles and PCode search are stored separately."
      />
      <View style={styles.mapFrame} accessibilityLabel="Interactive map view" accessibilityRole="none">
        {MAP_STYLE_URL ? (
          <MapSurface
            center={center}
            marker={routePoint}
            currentLocation={gpsLocation}
            selectedPlace={selectedPlace}
            isPlaceLoading={placeLookupLoading}
            placeError={placeLookupError}
            onCoordinatePress={openNearbySearch}
            onPinPress={(coordinates, kind) => void selectMapPin(coordinates, kind)}
            onPlacePress={openPlaceDetails}
            onDismissPlace={() => {
              setSelectedPlace(null);
              setPlaceLookupError(null);
            }}
            onCoverageChange={setViewport}
          />
        ) : (
          <View style={styles.mapUnavailable}>
            <MapPin size={26} color={colors.forest} />
            <Notice
              title="Map style not configured"
              detail="Add an offline-download licensed style URL to enable map rendering."
              tone="warning"
            />
          </View>
        )}
      </View>
      <Notice
        title={online === null ? 'Checking connection' : online ? 'Map can request online tiles' : 'Map network requests disabled'}
        detail={
          MAP_OFFLINE_DOWNLOADS_ENABLED
            ? 'An offline map pack is still required for dependable no-network map use.'
            : 'Offline pack downloads are disabled until regional download terms are confirmed with the provider.'
        }
        tone={online === false ? 'warning' : 'neutral'}
        icon={online === false ? WifiOff : Wifi}
      />
      <View style={styles.offlineMode}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="small" weight="semibold">
            Use downloaded maps only
          </AppText>
          <AppText variant="small" muted>
            Disable all network tile requests, even while online.
          </AppText>
        </View>
        <Switch
          value={offlineOnly}
          onValueChange={setOfflineOnly}
          accessibilityLabel="Use downloaded maps only"
          trackColor={{ false: colors.line, true: colors.forest }}
          thumbColor={colors.white}
        />
      </View>
      {packLoading ? (
        <ActivityIndicator color={colors.forest} />
      ) : packError ? (
        <Notice
          title="Map packs unavailable"
          detail={packError}
          tone="warning"
        />
      ) : (
        <Notice
          title={viewportCovered ? 'Offline coverage available' : 'Offline coverage unavailable here'}
          detail={
            viewportCovered
              ? 'A completed offline area covers the current map view.'
              : MAP_OFFLINE_DOWNLOADS_ENABLED
                ? 'Download a region to use this map area without network access.'
                : 'Offline packs are currently disabled; map tiles require network access.'
          }
          tone={viewportCovered ? 'success' : 'warning'}
          icon={MapPinned}
        />
      )}
      {locationError ? <Notice title="GPS location unavailable" detail={locationError} tone="warning" /> : null}
      {gpsLocation ? (
        <Notice
          title="Current GPS location"
          detail={`${gpsLocation.latitude.toFixed(5)}, ${gpsLocation.longitude.toFixed(5)} · red pin updates while the map is open`}
          tone="success"
          icon={MapPinned}
        />
      ) : null}
      <DatasetStatusNotice />
      <View style={styles.actions}>
        <ActionButton
          label="My location"
          icon={MapPinned}
          onPress={() => void requestCurrentLocation()}
          loading={locationLoading}
        />
        <ActionButton label="Manage offline areas" icon={MapPin} onPress={() => router.push('/offline/maps')} />
      </View>
      <Notice
        title={`${packs.length} offline ${packs.length === 1 ? 'area' : 'areas'} stored`}
        detail="Offline packs remain separate from the place database."
        tone="neutral"
      />
    </Page>
  );
}

const styles = {
  mapFrame: {
    height: 360,
    overflow: 'hidden' as const,
    borderRadius: radius.panel,
    backgroundColor: colors.surfaceMuted,
  },
  mapUnavailable: {
    flex: 1,
    minHeight: 330,
    justifyContent: 'center' as const,
    gap: spacing.md,
    padding: spacing.lg,
  },
  actions: { paddingBottom: spacing.xs },
  offlineMode: {
    minHeight: 66,
    paddingHorizontal: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    borderRadius: radius.panel,
    backgroundColor: colors.surface,
  },
};