import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { GoogleButton } from '@/components/google-button';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { signInWithGoogle } from '@/features/auth/google-sign-in';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';
import { api } from '@/lib/api';

// Google sign-in (W2-03). The app sends the Google ID token to the API, which checks it and
// returns a session token. Where to go next is decided by the splash screen.
export default function SignInScreen() {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { startSession } = useSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Runs the Google picker, sends the token to the API, then saves the session.
  async function onGoogle() {
    setBusy(true);
    setMessage(null);
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) {
        setMessage(t('auth.cancelled'));
        return;
      }
      const { sessionToken } = await api.signInWithGoogleToken(idToken);
      await startSession(sessionToken);
      router.replace('/' as Href);
    } catch {
      // Never show or log the token or raw error details.
      setMessage(t('auth.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false} back decor>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
        <Logo size={120} />
        <Text style={[type.title, { color: colors.text, textAlign: 'center' }]}>{t('auth.title')}</Text>
        <Text style={[type.body, { color: colors.muted, textAlign: 'center' }]}>{t('auth.hint')}</Text>
      </View>
      <View style={{ gap: space.md }}>
        <GoogleButton label={busy ? t('common.loading') : t('auth.google')} onPress={onGoogle} disabled={busy} />
        {message ? <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{message}</Text> : null}
      </View>
    </Screen>
  );
}
