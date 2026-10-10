import { ChevronRight, MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, radius, spacing } from '@/theme';
import type { PlaceRecord } from '@/types/pcode';

export function PlaceRow({
  place,
  onPress,
}: {
  place: PlaceRecord & { distance_km?: number };
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.name_eng ?? place.name_mmr ?? place.pcode}, PCode ${place.pcode}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={styles.marker}>
        <MapPin size={17} color={colors.forest} strokeWidth={1.8} />
      </View>
      <View style={styles.copy}>
        {place.name_mmr ? (
          <AppText variant="body" weight="myanmar" numberOfLines={1}>
            {place.name_mmr}
          </AppText>
        ) : null}
        <AppText variant="body" weight="semibold" numberOfLines={2}>
          {place.name_eng ?? 'Unnamed place'}
        </AppText>
        <AppText variant="small" muted numberOfLines={1}>
          {place.type.replaceAll('_', ' ')} · {place.pcode}
          {place.postal_code ? ` · ${place.postal_code}` : ''}
          {place.tsp_name ? ` · ${place.tsp_name}` : ''}
          {place.distance_km !== undefined ? ` · ${place.distance_km.toFixed(1)} km` : ''}
        </AppText>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 78,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: radius.capsule,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
});