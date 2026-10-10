import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, radius, spacing } from '@/theme';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  accessibilityHint?: string;
  accessibilityLabel?: string;
};

const variantColors = {
  primary: { background: colors.forest, foreground: colors.white, border: colors.forest },
  secondary: { background: colors.surface, foreground: colors.ink, border: colors.line },
  quiet: { background: 'transparent', foreground: colors.forest, border: 'transparent' },
  danger: { background: colors.coralSoft, foreground: colors.coral, border: colors.coralSoft },
};

export function ActionButton({
  label,
  onPress,
  icon: Icon,
  disabled = false,
  loading = false,
  variant = 'secondary',
  accessibilityHint,
  accessibilityLabel,
}: ActionButtonProps) {
  const palette = variantColors[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: disabled ? 0.48 : pressed ? 0.78 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.foreground} size="small" />
      ) : Icon ? (
        <Icon size={18} color={palette.foreground} strokeWidth={1.9} />
      ) : null}
      <AppText variant="small" weight="semibold" style={{ color: palette.foreground }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});