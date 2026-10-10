import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { NotoSansMyanmar_400Regular } from '@expo-google-fonts/noto-sans-myanmar';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Notice } from '@/components/notice';
import { AppDatabaseProvider } from '@/contexts/app-database-context';
import { DatasetStatusProvider } from '@/contexts/dataset-status-context';
import { colors, typography } from '@/theme';

export { ErrorBoundary } from 'expo-router';

void SplashScreen.preventAutoHideAsync();

function StartupFallback() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.forest} size="large" />
      <AppText variant="small" muted>
        Preparing offline place search
      </AppText>
    </View>
  );
}

function WebPlatformWarning() {
  return (
    <View style={styles.loading}>
      <Notice
        title="Web platform not supported"
        detail="This app requires native SQLite and MapLibre modules. Please run on Android or iOS with a development build."
        tone="danger"
      />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    [typography.regular]: DMSans_400Regular,
    [typography.medium]: DMSans_500Medium,
    [typography.semibold]: DMSans_600SemiBold,
    [typography.bold]: DMSans_700Bold,
    [typography.myanmar]: NotoSansMyanmar_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return <StartupFallback />;

  if (Platform.OS === 'web') return <WebPlatformWarning />;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="dark" />
        <Suspense fallback={<StartupFallback />}>
          <AppDatabaseProvider>
            <DatasetStatusProvider>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.forestDeep,
                  headerShadowVisible: false,
                  headerTitleStyle: { fontFamily: typography.semibold },
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="place/[pcode]" options={{ title: 'Place details' }} />
                <Stack.Screen name="offline/maps" options={{ title: 'Offline maps' }} />
                <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                <Stack.Screen name="search" options={{ title: 'Search places' }} />
                <Stack.Screen name="landmark" options={{ title: 'Landmark search' }} />
                <Stack.Screen name="about" options={{ title: 'About' }} />
              </Stack>
            </DatasetStatusProvider>
          </AppDatabaseProvider>
        </Suspense>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: colors.background,
  },
});
