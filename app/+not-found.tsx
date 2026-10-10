import { Stack, router } from 'expo-router';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Page } from '@/components/page';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <Page>
        <AppText variant="title" weight="semibold">
          This page is unavailable.
        </AppText>
        <ActionButton label="Return to places" onPress={() => router.replace('/')} variant="primary" />
      </Page>
    </>
  );
}
