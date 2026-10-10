import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { spacing } from '@/theme';

export function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.container}>
      <AppText variant="title" weight="semibold">
        {title}
      </AppText>
      {detail ? (
        <AppText variant="small" muted>
          {detail}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ container: { gap: spacing.xs } });