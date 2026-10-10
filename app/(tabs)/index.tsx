import { Link, router } from 'expo-router';
import { Database, Map, Navigation, Settings2 } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { DatasetStatusNotice } from '@/components/dataset-status';
import { Notice } from '@/components/notice';
import { Page } from '@/components/page';
import { PlaceSearchPanel } from '@/components/place-search-panel';
import { SectionHeading } from '@/components/section-heading';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { colors, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const online = useNetworkStatus();

  return (
    <Page includeTopInset>
      <View style={styles.topRow}>
        <View style={styles.brandMark}>
          <Map size={18} color={colors.lime} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="label" weight="bold" style={styles.kicker}>
            FIELD ATLAS · MYANMAR
          </AppText>
          <AppText variant="small" muted>
            Place codes, made practical.
          </AppText>
        </View>
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Open settings" style={styles.iconButton}>
            <Settings2 size={20} color={colors.ink} strokeWidth={1.8} />
          </Pressable>
        </Link>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <AppText variant="display" weight="bold" style={styles.heroTitle}>
            Find your place.
          </AppText>
          <AppText variant="body" style={styles.heroDetail}>
            Search administrative places by name, PCode, postal code, or coordinates.
          </AppText>
        </View>
        <View style={styles.heroStamp}>
          <AppText variant="label" weight="bold" style={styles.heroStampText}>
            OFFLINE
          </AppText>
          <Database size={17} color={colors.forestDeep} />
        </View>
      </View>

      <View style={styles.statusStack}>
        <Notice
          title={online === null ? 'Checking connection' : online ? 'Online services available' : 'Offline mode'}
          detail="Place search stays local; maps and landmark lookup depend on their separate coverage."
          tone={online === false ? 'warning' : 'neutral'}
        />
        <DatasetStatusNotice />
      </View>

      <View style={styles.section}>
        <SectionHeading title="Search Myanmar" detail="English · မြန်မာ · PCode · postal" />
        <PlaceSearchPanel compact />
      </View>

      <View style={styles.section}>
        <SectionHeading title="Go to" detail="Your field tools" />
        <View style={styles.actions}>
          <ActionButton
            label="My location"
            icon={Navigation}
            onPress={() => router.push('/nearby')}
            variant="primary"
          />
          <ActionButton
            label="Offline maps"
            icon={Map}
            onPress={() => router.push('/offline/maps')}
          />
        </View>
        <Link href="/search" asChild>
          <Pressable accessibilityRole="button" style={styles.linkButton}>
            <AppText variant="small" weight="semibold" style={{ color: colors.forest }}>
              Open full search
            </AppText>
          </Pressable>
        </Link>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest,
  },
  kicker: { color: colors.forest, fontSize: 11 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  hero: {
    minHeight: 204,
    padding: spacing.lg,
    backgroundColor: colors.forest,
    borderRadius: radius.panel,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroCopy: { maxWidth: 380, gap: spacing.sm },
  heroTitle: { color: colors.white, fontSize: 34, lineHeight: 40 },
  heroDetail: { color: '#E5F0E9', maxWidth: 320 },
  heroStamp: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.lime,
  },
  heroStampText: { color: colors.forestDeep, fontSize: 10 },
  statusStack: { gap: spacing.sm },
  section: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  linkButton: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
});
