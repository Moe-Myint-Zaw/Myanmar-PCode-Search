import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, radius, spacing } from '@/theme';

type NoticeTone = 'neutral' | 'warning' | 'success' | 'danger';

const toneColors: Record<NoticeTone, { background: string; foreground: string }> = {
  neutral: { background: colors.surfaceMuted, foreground: colors.ink },
  warning: { background: colors.amberSoft, foreground: colors.amber },
  success: { background: colors.limeSoft, foreground: colors.forestDeep },
  danger: { background: colors.coralSoft, foreground: colors.coral },
};

export function Notice({
  title,
  detail,
  tone = 'neutral',
  icon: Icon,
}: {
  title: string;
  detail?: string;
  tone?: NoticeTone;
  icon?: LucideIcon;
}) {
  const palette = toneColors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette.background }]}>
      {Icon ? <Icon size={19} color={palette.foreground} strokeWidth={1.8} /> : null}
      <View style={styles.copy}>
        <AppText variant="small" weight="semibold" style={{ color: palette.foreground }}>
          {title}
        </AppText>
        {detail ? (
          <AppText variant="small" style={{ color: palette.foreground }}>
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.panel,
  },
  copy: { flex: 1, gap: 3 },
});