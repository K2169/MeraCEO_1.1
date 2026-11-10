import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessionProvider } from '@/features/auth/session-provider';

// Keep the native splash up until the fonts are ready, so no screen shows in the wrong font.
void SplashScreen.preventAutoHideAsync();
// When the splash goes away it fades out over 400ms into the first screen.
SplashScreen.setOptions({ duration: 400, fade: true });

// Root of the app: loads the fonts, then wraps every screen in the session provider.
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });

  // Hide the native splash once the fonts are loaded.
  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Draw nothing until the fonts are ready.
  if (!fontsLoaded) return null;

  return (
    <SessionProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </SessionProvider>
  );
}
