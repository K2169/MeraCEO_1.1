import { type Href, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { t } from '@/i18n';

// Get started page: shown to signed-out people after the splash.
// The main button goes to the role choice. The link goes to sign-in for people who already have an account.
export default function GetStarted() {
  const { colors, space, type } = useTheme();
  const router = useRouter();

  return (
    <Screen scroll={false} decor>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.md }}>
        <Logo size={150} />
        <Text style={[type.title, { color: colors.text, textAlign: 'center' }]}>{t('welcome.title')}</Text>
        <Text style={[type.body, { color: colors.muted, textAlign: 'center' }]}>{t('welcome.subtitle')}</Text>
      </View>
      <View style={{ gap: space.md, alignItems: 'stretch' }}>
        <Button label={t('getStarted.cta')} onPress={() => router.push('/role' as Href)} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in' as Href)} style={{ alignItems: 'center', padding: space.sm }}>
          <Text style={[type.body, { color: colors.primary, fontFamily: 'DMSans_600SemiBold' }]}>{t('getStarted.signIn')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
