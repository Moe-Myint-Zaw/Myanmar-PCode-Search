import { ChevronRight, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, radius, spacing } from '@/theme';
import type { PlaceRecord } from '@/types/pcode';

type MapPlaceCardProps = {
  place: PlaceRecord | null;
  loading: boolean;
  error: string | null;
  bottomOffset?: number;
  onPress: (place: PlaceRecord) => void;
  onDismiss: () => void;
};

export function MapPlaceCard({
  place,
  loading,
  error,
  bottomOffset = spacing.sm,
  onPress,
  onDismiss,
}: MapPlaceCardProps) {
  if (!place && !loading && !error) return null;

  if (!place) {
    return (
      <View style={[styles.card, { bottom: bottomOffset }]} accessibilityLiveRegion="polite">
        <View style={styles.message}>
          <AppText variant="small" weight="semibold">
            {loading ? 'Loading place details…' : 'Place details unavailable'}
          </AppText>
          {error ? <AppText variant="small" muted>{error}</AppText> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss place details"
          onPress={onDismiss}
          style={styles.dismissButton}
        >
          <X size={18} color={colors.muted} />
        </Pressable>
      </View>
    );
  }

  const title = place.name_eng ?? place.name_mmr ?? place.pcode;

  return (
    <View style={[styles.card, { bottom: bottomOffset }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open details for ${title}`}
        accessibilityHint="Opens this place's full details"
        onPress={() => onPress(place)}
        style={({ pressed }) => [styles.placeButton, pressed && styles.pressed]}
      >
        <View style={styles.placeContent}>
          <AppText variant="body" weight="semibold" numberOfLines={1}>
            {title}
          </AppText>
          {place.name_mmr && place.name_eng ? (
            <AppText variant="small" muted numberOfLines={1}>
              {place.name_mmr}
            </AppText>
          ) : null}
          <View style={styles.hierarchy}>
            <HierarchyValue label="State/Region" value={place.sr_name} />
            <HierarchyValue label="District" value={place.district_name} />
            <HierarchyValue label="Township" value={place.tsp_name} />
          </View>
        </View>
        <ChevronRight size={21} color={colors.forest} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss place details"
        onPress={onDismiss}
        style={styles.dismissButton}
      >
        <X size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function HierarchyValue({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.hierarchyRow}>
      <AppText variant="small" muted style={styles.label}>
        {label}
      </AppText>
      <AppText variant="small" weight="medium" numberOfLines={2} style={styles.value}>
        {value ?? 'Not available'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    boxShadow: '0 2px 8px rgba(23, 35, 30, 0.24)',
  },
  placeButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  placeContent: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  hierarchy: {
    gap: 2,
    paddingTop: spacing.xs,
  },
  hierarchyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  label: {
    width: 112,
  },
  value: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    flex: 1,
    gap: spacing.xs,
  },
  dismissButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.xs,
    marginRight: -spacing.xs,
  },
  pressed: {
    opacity: 0.72,
  },
});
