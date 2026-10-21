import type { CameraRef } from '@maplibre/maplibre-react-native';
import { LocateFixed, MapPin, Minus, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MapPlaceCard } from '@/components/map-place-card';
import { Notice } from '@/components/notice';
import { MAP_STYLE_URL } from '@/map/map-config';
import { loadMapLibre } from '@/map/maplibre-runtime';
import { colors, radius, spacing } from '@/theme';
import type { Coordinates } from '@/types/pcode';
import type { MapSurfaceProps } from './map-surface';

const MIN_ZOOM = 0;
const MAX_ZOOM = 22;
const INITIAL_ZOOM = 11;

export function MapSurface({
  center,
  marker,
  currentLocation,
  route,
  overlayBottomInset = 0,
  selectedPlace,
  isPlaceLoading = false,
  isCurrentLocationLoading = false,
  placeError = null,
  onCoordinatePress,
  onCurrentLocationPress,
  onPinPress,
  onPlacePress,
  onDismissPlace,
  onCoverageChange,
}: MapSurfaceProps) {
  const camera = useRef<CameraRef>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [mapStyleLoaded, setMapStyleLoaded] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<Coordinates | null>(null);
  const mapLibre = loadMapLibre();

  useEffect(() => {
    camera.current?.flyTo({ center: [center.longitude, center.latitude], duration: 450 });
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    if (!route || route.coordinates.length < 2) return;
    const firstCoordinate = route.coordinates[0]!;
    const bounds = route.coordinates.reduce(
      (current, [longitude, latitude]) => ({
        west: Math.min(current.west, longitude),
        south: Math.min(current.south, latitude),
        east: Math.max(current.east, longitude),
        north: Math.max(current.north, latitude),
      }),
      {
        west: firstCoordinate[0],
        south: firstCoordinate[1],
        east: firstCoordinate[0],
        north: firstCoordinate[1],
      },
    );
    camera.current?.fitBounds(
      [bounds.west, bounds.south, bounds.east, bounds.north],
      {
        padding: {
          top: spacing.xl,
          right: spacing.xl,
          bottom: overlayBottomInset + spacing.xl,
          left: spacing.xl,
        },
        duration: 800,
      },
    );
  }, [overlayBottomInset, route]);

  if (!MAP_STYLE_URL) return null;
  if (!mapLibre) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
        <Notice
          title="Map needs a rebuilt app"
          detail="Expo Go does not include MapLibre. Use the native development build with npm run android or npm run ios to test the map."
          tone="warning"
        />
      </View>
    );
  }

  const { Camera, GeoJSONSource, Layer, Map, Marker } = mapLibre;

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        attribution
        logo
        compass
        scaleBar
        dragPan
        touchZoom
        doubleTapZoom
        doubleTapHoldZoom
        onPress={(event) => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          const point = { latitude, longitude };
          setSelectedPoint(point);
          camera.current?.flyTo({ center: [longitude, latitude], duration: 350 });
        }}
        onRegionDidChange={(event) => {
          setZoom(event.nativeEvent.zoom);
          onCoverageChange?.(event.nativeEvent.bounds);
        }}
        onDidFinishLoadingStyle={() => setMapStyleLoaded(true)}
      >
        <Camera
          ref={camera}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          initialViewState={{ center: [center.longitude, center.latitude], zoom: INITIAL_ZOOM }}
        />
        {route ? (
          <GeoJSONSource
            id="search-route-source"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: route.coordinates },
            }}
          >
            <Layer
              id="search-route-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.white, 'line-width': 9, 'line-opacity': 0.9 }}
            />
            <Layer
              id="search-route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#4285F4', 'line-width': 5, 'line-opacity': 1 }}
            />
          </GeoJSONSource>
        ) : null}
        {mapStyleLoaded && marker ? (
          <Marker
            lngLat={[marker.longitude, marker.latitude]}
            onPress={() => onPinPress?.(marker, 'place')}
          >
            <View style={styles.marker}>
              <MapPin size={17} color={colors.white} fill={colors.forest} />
            </View>
          </Marker>
        ) : null}
        {mapStyleLoaded && currentLocation ? (
          <Marker
            id="current-location"
            lngLat={[currentLocation.longitude, currentLocation.latitude]}
            onPress={() => onPinPress?.(currentLocation, 'current-location')}
          >
            <View style={styles.currentLocationMarker}>
              <MapPin size={22} color={colors.white} fill={colors.coral} strokeWidth={2.5} />
            </View>
          </Marker>
        ) : null}
      </Map>
      {onCurrentLocationPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to current location"
          accessibilityHint="Centers the map on your current GPS location"
          accessibilityState={{ busy: isCurrentLocationLoading }}
          disabled={isCurrentLocationLoading}
          onPress={onCurrentLocationPress}
          style={({ pressed }) => [
            styles.locationButton,
            { bottom: overlayBottomInset + spacing.md },
            pressed && styles.zoomButtonInactive,
          ]}
        >
          {isCurrentLocationLoading ? (
            <ActivityIndicator size="small" color={colors.forest} />
          ) : (
            <LocateFixed size={22} color={colors.ink} />
          )}
        </Pressable>
      ) : null}
      <MapPlaceCard
        place={selectedPlace ?? null}
        loading={isPlaceLoading}
        error={placeError}
        bottomOffset={overlayBottomInset + (onCurrentLocationPress ? spacing.md + 48 + spacing.sm : spacing.sm)}
        onPress={(place) => onPlacePress?.(place)}
        onDismiss={() => onDismissPlace?.()}
      />
      <View style={styles.zoomControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          accessibilityHint="Increase map zoom level"
          disabled={zoom >= MAX_ZOOM}
          onPress={() => camera.current?.zoomTo(Math.min(zoom + 1, MAX_ZOOM), { duration: 200 })}
          style={({ pressed }) => [
            styles.zoomButton,
            styles.zoomInButton,
            (pressed || zoom >= MAX_ZOOM) && styles.zoomButtonInactive,
          ]}
        >
          <Plus size={22} color={colors.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          accessibilityHint="Decrease map zoom level"
          disabled={zoom <= MIN_ZOOM}
          onPress={() => camera.current?.zoomTo(Math.max(zoom - 1, MIN_ZOOM), { duration: 200 })}
          style={({ pressed }) => [
            styles.zoomButton,
            (pressed || zoom <= MIN_ZOOM) && styles.zoomButtonInactive,
          ]}
        >
          <Minus size={22} color={colors.ink} />
        </Pressable>
      </View>
      {selectedPoint && onCoordinatePress && !selectedPlace && !isPlaceLoading && !placeError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search this point"
          accessibilityHint="Find nearby places around the point selected on the map"
          onPress={() => onCoordinatePress(selectedPoint)}
          style={({ pressed }) => [
            styles.searchPointButton,
            { bottom: overlayBottomInset + spacing.md + 48 + spacing.sm },
            pressed && styles.zoomButtonInactive,
          ]}
        >
          <MapPin size={17} color={colors.white} />
          <AppText variant="small" weight="semibold" style={{ color: colors.white }}>
            Search this point
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest,
    borderWidth: 3,
    borderColor: colors.lime,
  },
  currentLocationMarker: {
    width: 42,
    height: 42,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coral,
    borderWidth: 3,
    borderColor: colors.white,
  },
  zoomControls: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    overflow: 'hidden',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    elevation: 3,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  locationButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    elevation: 3,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  zoomButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  zoomInButton: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  zoomButtonInactive: {
    opacity: 0.55,
  },
  searchPointButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xl,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.forest,
    elevation: 3,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});