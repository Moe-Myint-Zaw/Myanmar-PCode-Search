import { useLocalSearchParams } from 'expo-router';

import { Page } from '@/components/page';
import { PlaceSearchPanel } from '@/components/place-search-panel';

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  return (
    <Page>
      <PlaceSearchPanel initialValue={typeof q === 'string' ? q : ''} />
    </Page>
  );
}