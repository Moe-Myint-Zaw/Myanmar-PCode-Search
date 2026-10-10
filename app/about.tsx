import { ExternalLink, ShieldCheck } from 'lucide-react-native';
import { Linking, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Notice } from '@/components/notice';
import { Page } from '@/components/page';
import { SectionHeading } from '@/components/section-heading';
import {
  DEFAULT_MAP_STYLE_URL,
  MAP_OFFLINE_DOWNLOADS_ENABLED,
  MAP_STYLE_URL,
  MAX_OFFLINE_TILE_COUNT,
} from '@/map/map-config';
import { spacing } from '@/theme';

export default function AboutScreen() {
  return (
    <Page>
      <SectionHeading title="About this field tool" detail="Myanmar PCode Search · Android and iOS" />
      <Notice
        title="Designed for low-connectivity work"
        detail="Place search, PCodes, postal codes, and GPS matching use the installed local database."
        tone="success"
        icon={ShieldCheck}
      />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="body" weight="semibold">
          Data provenance
        </AppText>
        <AppText variant="small" muted>
          The dataset build records MIMU PCode release, Myanmar Postal Code data, OCHA COD-AB coordinate provenance, and version metadata. Coordinate source is shown with each place and approximate coordinates are not presented as surveyed.
        </AppText>
      </View>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="body" weight="semibold">
          Map provider
        </AppText>
        <AppText variant="small" muted>
          {MAP_STYLE_URL === DEFAULT_MAP_STYLE_URL
            ? `OpenFreeMap Liberty · ${MAP_STYLE_URL}\nOpenStreetMap data · MapLibre displays attribution on the map. OpenFreeMap publishes downloadable MBTiles and states that its public service has no request/view limits; availability has no SLA. Regional downloads are ${MAP_OFFLINE_DOWNLOADS_ENABLED ? 'enabled' : 'disabled'} and capped at ${MAX_OFFLINE_TILE_COUNT.toLocaleString()} estimated tiles per device.`
            : `Configured map style · ${MAP_STYLE_URL}\nReview the provider's attribution and usage terms. Offline downloads are ${MAP_OFFLINE_DOWNLOADS_ENABLED ? 'enabled' : 'disabled'} for this provider.`}
        </AppText>
        {MAP_STYLE_URL === DEFAULT_MAP_STYLE_URL ? (
          <>
            <ActionButton
              label="Open OpenStreetMap attribution"
              icon={ExternalLink}
              onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}
            />
            <ActionButton
              label="Open map provider"
              icon={ExternalLink}
              onPress={() => void Linking.openURL('https://openfreemap.org/')}
              variant="quiet"
            />
          </>
        ) : null}
      </View>
      <AppText variant="small" muted>
        Never upload GPS coordinates for normal nearby place lookup. External landmark lookup is a separate, user-initiated online action.
      </AppText>
    </Page>
  );
}