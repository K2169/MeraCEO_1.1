import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Text, View } from 'react-native';

import { Logo } from '@/components/logo';
import { useTheme } from '@/components/use-theme';
import { nextRoute } from '@/features/auth/routing';
import { progress } from '@/features/auth/progress-store';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';
import { api, ApiError } from '@/lib/api';

// Splash: the logo eases in while the saved session loads, then the person is sent to the right screen.
export default function Splash() {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { loading, user, token, refresh } = useSession();
  const enter = useRef(new Animated.Value(0)).current;

  // Start the logo animation once when the splash appears.
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [enter]);

  // Once the session is loaded, decide where to go next.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      if (!user || !token) {
        router.replace('/get-started' as Href);
        return;
      }
      // A role picked before signing in is applied once the age check has passed.
      if (user.dateOfBirthSet && user.ageConfirmed === true && user.role === null) {
        const intended = await progress.getIntendedRole();
        if (intended) {
          try {
            await api.setRole(token, intended);
          } catch (err) {
            // 409 means the role is already set on the server, so the refresh below picks it up.
            if (!(err instanceof ApiError && err.status === 409)) {
              if (!cancelled) router.replace('/role' as Href);
              return;
            }
          }
          await refresh();
          return;
        }
      }
      if (!cancelled) router.replace(nextRoute(user));
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, token, refresh, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.xxl, backgroundColor: colors.background }}>
      <Animated.View style={{ opacity: enter, transform: [{ scale: enter }] }}>
        <Logo size={124} />
      </Animated.View>
      <Text style={[type.display, { color: colors.text, textAlign: 'center' }]}>{t('app.name')}</Text>
      <Text style={[type.body, { color: colors.muted, textAlign: 'center', maxWidth: 320 }]}>{t('welcome.subtitle')}</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: space.lg }} />
    </View>
  );
}
