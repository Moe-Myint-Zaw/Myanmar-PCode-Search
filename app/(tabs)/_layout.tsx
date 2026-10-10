import { Tabs } from 'expo-router';
import { Layers3, MapPinned, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography } from '@/theme';

const TAB_BAR_CONTENT_HEIGHT = 68;
const TAB_BAR_BOTTOM_PADDING = 8;

export default function TabLayout() {
  const { bottom: bottomInset } = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 8,
          paddingBottom: TAB_BAR_BOTTOM_PADDING + bottomInset,
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontFamily: typography.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Places',
          tabBarIcon: ({ color }) => <Search size={21} color={color} strokeWidth={1.9} />,
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Nearby',
          tabBarIcon: ({ color }) => <MapPinned size={21} color={color} strokeWidth={1.9} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <Layers3 size={21} color={color} strokeWidth={1.9} />,
        }}
      />
    </Tabs>
  );
}
