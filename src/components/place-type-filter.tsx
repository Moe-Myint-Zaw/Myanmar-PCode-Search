import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, radius, spacing } from '@/theme';
import type { PlaceTypeFilter } from '@/types/pcode';

const filters: { value: PlaceTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'town', label: 'Town' },
  { value: 'ward', label: 'Ward' },
  { value: 'village_tract', label: 'Village tract' },
  { value: 'village', label: 'Village' },
  { value: 'postal', label: 'Postal' },
];

export function PlaceTypeFilterControl({
  value,
  onChange,
}: {
  value: PlaceTypeFilter;
  onChange: (value: PlaceTypeFilter) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Place type">
        {filters.map((filter) => {
          const selected = filter.value === value;
          return (
            <Pressable
              key={filter.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={filter.label}
              onPress={() => onChange(filter.value)}
              style={[styles.option, selected && styles.selected]}
            >
              <AppText
                variant="small"
                weight="medium"
                style={{ color: selected ? colors.white : colors.secondaryInk }}
              >
                {filter.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  option: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.forest, backgroundColor: colors.forest },
});