import { LocateFixed, MapPin, MoveUpRight } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MapPlaceCard } from '@/components/map-place-card';
import { colors, radius, spacing } from '@/theme';
import type { MapSurfaceProps } from './map-surface';

export function MapSurface({
  center,
  currentLocation,
  overlayBottomInset = 0,
  selectedPlace,
  isPlaceLoading = false,
  isCurrentLocationLoading = false,
  placeError = null,
  onCoordinatePress,
  onCurrentLocationPress,
  onPlacePress,
  onDismissPlace,
}: MapSurfaceProps) {
  return (
    <View style={styles.surface}>
      <View style={styles.grid} />
      {onCurrentLocationPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to current location"
          accessibilityHint="Centers the map on your current GPS location"
          accessibilityState={{ busy: isCurrentLocationLoading }}
          disabled={isCurrentLocationLoading}
          onPress={onCurrentLocationPress}
          style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}
        >
          {isCurrentLocationLoading ? (
            <ActivityIndicator size="small" color={colors.forest} />
          ) : (
            <LocateFixed size={22} color={colors.ink} />
          )}
        </Pressable>
      ) : null}
      <View style={styles.centerMark}>
        <MapPin
          size={23}
          color={currentLocation ? colors.coral : colors.forest}
          fill={currentLocation ? colors.coral : 'transparent'}
        />
      </View>
      <MapPlaceCard
        place={selectedPlace ?? null}
        loading={isPlaceLoading}
        error={placeError}
        bottomOffset={overlayBottomInset + (onCurrentLocationPress ? spacing.md + 48 + spacing.sm : spacing.sm)}
        onPress={(place) => onPlacePress?.(place)}
        onDismiss={() => onDismissPlace?.()}
      />
      <View style={styles.readout}>
        <AppText variant="label" weight="bold" style={{ color: colors.forest }}>
          MAPLibre NATIVE VIEW
        </AppText>
        <AppText variant="small">
          Native map rendering is available in the Android/iOS development build.
        </AppText>
        <AppText variant="small" muted>
          {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
        </AppText>
      </View>
      {onCoordinatePress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use current map center for nearby search"
          onPress={() => onCoordinatePress(center)}
          style={styles.action}
        >
          <MoveUpRight size={17} color={colors.white} />
          <AppText variant="small" weight="semibold" style={{ color: colors.white }}>
            Search this point
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    minHeight: 300,
    overflow: 'hidden',
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#E6ECE4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  grid: {
    ...StyleSheet.absoluteFill,
    opacity: 0.42,
    backgroundColor: '#E6ECE4',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#B9C9BB',
  },
  locationButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    zIndex: 1,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.72 },
  centerMark: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    borderColor: colors.forest,
    borderWidth: 1,
    backgroundColor: colors.limeSoft,
  },
  readout: {
    padding: spacing.md,
    borderRadius: radius.panel,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: spacing.xs,
  },
  action: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.forest,
  },
});