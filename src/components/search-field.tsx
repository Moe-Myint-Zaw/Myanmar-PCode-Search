import { Search, X } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, radius, spacing, typography } from '@/theme';

type SearchFieldProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
};

export function SearchField({ value, onChangeText, onClear, ...props }: SearchFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Search size={20} color={colors.secondaryInk} strokeWidth={1.8} />
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        accessibilityLabel={props.accessibilityLabel ?? 'Search by place, PCode, postal code, or coordinates'}
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={onClear ?? (() => onChangeText(''))}
          hitSlop={8}
          style={styles.clear}
        >
          <X size={17} color={colors.secondaryInk} />
          <AppText variant="small" style={styles.clearText}>
            Clear
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.panel,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    fontFamily: typography.regular,
    fontSize: 16,
    color: colors.ink,
  },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  clearText: { color: colors.secondaryInk },
});