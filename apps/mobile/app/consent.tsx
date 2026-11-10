import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { Screen } from '@/components/screen';
import { ScrollBody } from '@/components/scroll-body';
import { useTheme } from '@/components/use-theme';
import { progress } from '@/features/auth/progress-store';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';
import { api } from '@/lib/api';

// Consent (W3-04): four boxes, all unticked. Terms must be ticked. Each choice is saved as its own event.
export default function ConsentScreen() {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { token, refresh } = useSession();
  const [choices, setChoices] = useState({ matching: false, contact_sharing: false, notifications: false, terms: false });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Check the terms box, save every choice, then go to the dashboard.
  async function submit() {
    if (!token) return;
    if (!choices.terms) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.recordConsents(
        token,
        (Object.keys(choices) as (keyof typeof choices)[]).map((type) => ({ type, granted: choices[type] })),
      );
      await refresh();
      router.replace('/' as Href);
    } catch {
      setMessage(t('consent.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false} decor>
      <View style={{ gap: space.xs }}>
        <Text style={[type.title, { color: colors.text }]}>{t('consent.title')}</Text>
        <Text style={[type.body, { color: colors.muted }]}>{t('consent.body')}</Text>
      </View>

      <ScrollBody>
        <View style={{ gap: space.md }}>
          {/* Optional choices: all start unticked */}
          <Text style={[type.caption, { color: colors.muted }]}>{t('consent.optional')}</Text>
          <Checkbox label={t('consent.matchingTitle')} description={t('consent.matching')} checked={choices.matching} onChange={(v) => setChoices({ ...choices, matching: v })} />
          <Checkbox label={t('consent.contactTitle')} description={t('consent.contact')} checked={choices.contact_sharing} onChange={(v) => setChoices({ ...choices, contact_sharing: v })} />
          <Checkbox label={t('consent.notificationsTitle')} description={t('consent.notifications')} checked={choices.notifications} onChange={(v) => setChoices({ ...choices, notifications: v })} />

          {/* The one choice we need before the person can continue */}
          <Text style={[type.caption, { color: colors.muted, marginTop: space.sm }]}>{t('consent.required')}</Text>
          <Checkbox label={t('consent.termsTitle')} description={t('consent.terms')} badge={t('consent.required')} checked={choices.terms} onChange={(v) => setChoices({ ...choices, terms: v })} />

          {/* Placeholder wording until the lawyer signs off */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name="information-circle-outline" size={18} color={colors.muted} />
            <Text style={[type.caption, { color: colors.muted, flex: 1 }]}>{t('consent.draftNotice')}</Text>
          </View>
        </View>
      </ScrollBody>

      {message ? <Text style={[type.caption, { color: colors.danger }]}>{message}</Text> : null}
      {!choices.terms ? <Text style={[type.caption, { color: colors.muted, textAlign: 'center' }]}>{t('consent.termsHint')}</Text> : null}
      <Button label={busy ? t('common.loading') : t('consent.submit')} onPress={submit} disabled={busy || !choices.terms} arrow />
    </Screen>
  );
}
