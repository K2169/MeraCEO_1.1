import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { api } from '@/lib/api';
import { t } from '@/i18n';

// Public support information is available before authentication as well as from Settings.
export default function SupportScreen() {
  const { colors, space, type } = useTheme();
  const { token } = useSession();
  const router = useRouter();
  const [contact, setContact] = useState<{ email: string | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    try { setContact(await api.getSupport()); }
    catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <Screen back>
    <Text style={[type.title, { color: colors.text }]}>{t('support.title')}</Text>
    <Text style={[type.body, { color: colors.text }]}>{t('settings.helpBody')}</Text>
    {contact ? <View style={{ gap: space.sm }}>
      <Text style={[type.caption, { color: colors.muted }]}>{t('support.emailLabel')}</Text>
      <Text selectable style={[type.body, { color: colors.text }]}>{contact.email ?? t('support.unavailable')}</Text>
    </View> : failed ? <View style={{ gap: space.md }}><Text accessibilityRole="alert" style={[type.body, { color: colors.danger }]}>{t('common.genericError')}</Text><Button label={t('common.retry')} onPress={() => void load()} /></View> : <ActivityIndicator color={colors.primary} />}
    <Button label={t(token ? 'support.report' : 'support.signInToReport')} onPress={() => router.push((token ? '/report-problem' : '/sign-in') as Href)} />
  </Screen>;
}
