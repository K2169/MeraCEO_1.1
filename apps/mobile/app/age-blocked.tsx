import { type Href, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { IconBubble } from '@/components/icon-bubble';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { progress } from '@/features/auth/progress-store';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';

// Shown to under-18s. No onboarding data is created. The only action is to sign out.
export default function AgeBlocked() {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { signOut } = useSession();

  // Clear on-device progress, sign out, and go back to the welcome screen.
  async function leave() {
    await progress.clearAll();
    await signOut();
    router.replace('/get-started' as Href);
  }

  return (
    <Screen scroll={false} decor>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
        <IconBubble icon="information-circle-outline" tint="green" size={130} />
        <Text style={[type.title, { color: colors.text, textAlign: 'center' }]}>{t('age.blockedTitle')}</Text>
        <Text style={[type.body, { color: colors.muted, textAlign: 'center' }]}>{t('age.blockedBody')}</Text>
      </View>
      <Button label={t('common.signOut')} variant="secondary" onPress={leave} />
    </Screen>
  );
}
