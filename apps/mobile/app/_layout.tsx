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
import { useEffect, useState } from 'react';

import { initializePreferences, usePreferences } from '@/features/settings/preferences';
import { SessionProvider } from '@/features/auth/session-provider';
import { IncomingCallListener } from '@/features/messages/incoming-call-listener';
import { ToastProvider } from '@/components/toast';

// Keep the native splash up until the fonts are ready, so no screen shows in the wrong font.
void SplashScreen.preventAutoHideAsync();
// When the splash goes away it fades out over 400ms into the first screen.
SplashScreen.setOptions({ duration: 400, fade: true });

// Root of the app: loads the fonts, then wraps every screen in the session provider.
export default function RootLayout() {
  const preferences = usePreferences();
  const [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => { void initializePreferences().finally(() => setPreferencesReady(true)); }, []);
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });

  // Hide the native splash once the fonts are loaded.
  useEffect(() => {
    if (fontsLoaded && preferencesReady) void SplashScreen.hideAsync();
  }, [fontsLoaded, preferencesReady]);

  // Draw nothing until the fonts are ready.
  if (!fontsLoaded || !preferencesReady) return null;

  return (
    <SessionProvider>
      <ToastProvider key={preferences.language}>
        <IncomingCallListener />
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </ToastProvider>
    </SessionProvider>
  );
}
