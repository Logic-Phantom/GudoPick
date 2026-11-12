import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/design-system/tokens';
import { AppDataProvider } from '@/features/app-data/AppDataProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppDataProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen
            name="camera"
            options={{ animation: 'slide_from_bottom', contentStyle: { backgroundColor: colors.dark } }}
          />
          <Stack.Screen
            name="capture-review"
            options={{ animation: 'fade', gestureEnabled: false, contentStyle: { backgroundColor: colors.dark } }}
          />
          <Stack.Screen name="preset-edit" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/[section]" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </AppDataProvider>
    </SafeAreaProvider>
  );
}
