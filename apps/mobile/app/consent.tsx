import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { Screen } from '@/components/screen';
import { ScrollBody } from '@/components/scroll-body';
import { useTheme } from '@/components/use-theme';
import { progress } from '@/features/auth/progress-store';
import { consentChoiceSignature, newConsentIdempotencyKey } from '@/features/auth/consent-idempotency';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';
import { api } from '@/lib/api';

type ProfessionalConsentDraft = {
  consentIdempotencyKey?: string;
  consentIdempotencyChoiceSignature?: string;
  consentChoices?: { matching?: boolean; contact_sharing?: boolean; notifications?: boolean };
};

// Consent (W3-04): four boxes, all unticked. Terms must be ticked. Each choice is saved as its own event.
export default function ConsentScreen() {
  const { colors, radius, space, type } = useTheme();
  const router = useRouter();
  const { token, user, refresh } = useSession();
  const [choices, setChoices] = useState({ matching: false, contact_sharing: false, notifications: false, terms: false });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [p1dDraft, setP1dDraft] = useState<ProfessionalConsentDraft | null>(null);
  const [recoveringP1D, setRecoveringP1D] = useState(Boolean(user?.role));

  // If P1D saved the profile but the consent response was lost, root routing lands here.
  // Restore the exact P1D choices and key so retrying fills any missing events without duplicates.
  useEffect(() => {
    if (!user?.role) {
      setRecoveringP1D(false);
      return;
    }
    let active = true;
    progress.getDraft<ProfessionalConsentDraft>(user.role, user.id).then((draft) => {
      if (!active || !draft?.consentIdempotencyKey) return;
      setP1dDraft(draft);
      setChoices({
        matching: draft.consentChoices?.matching === true,
        contact_sharing: draft.consentChoices?.contact_sharing === true,
        notifications: draft.consentChoices?.notifications === true,
        terms: true,
      });
    }).catch(() => undefined).finally(() => {
      if (active) setRecoveringP1D(false);
    });
    return () => { active = false; };
  }, [user?.id, user?.role]);

  // Check the terms box, save every choice, then go to the dashboard.
  async function submit() {
    if (!token || !user?.id) return;
    if (!choices.terms) return;
    setBusy(true);
    setMessage(null);
    try {
      let idempotencyKey: string | undefined;
      if (p1dDraft) {
        const optionalChoices = {
          matching: choices.matching,
          contact_sharing: choices.contact_sharing,
          notifications: choices.notifications,
        };
        const signature = consentChoiceSignature(optionalChoices);
        const savedSignature = p1dDraft.consentIdempotencyChoiceSignature ?? consentChoiceSignature(p1dDraft.consentChoices);
        idempotencyKey = savedSignature === signature
          ? p1dDraft.consentIdempotencyKey
          : newConsentIdempotencyKey();
        const retryDraft: ProfessionalConsentDraft = {
          ...p1dDraft,
          consentIdempotencyKey: idempotencyKey,
          consentIdempotencyChoiceSignature: signature,
          consentChoices: optionalChoices,
        };
        await progress.setDraft(user.role!, retryDraft, user.id);
        setP1dDraft(retryDraft);
      }
      await api.recordConsents(
        token,
        (Object.keys(choices) as (keyof typeof choices)[]).map((type) => ({ type, granted: choices[type] })),
        idempotencyKey,
      );
      if (p1dDraft) await progress.clearDraft(user.role!, user.id);
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
        <Text style={[type.title, { color: colors.text }]}>{t(p1dDraft ? 'consent.resumeP1DTitle' : 'consent.title')}</Text>
        <Text style={[type.body, { color: colors.muted }]}>{t(p1dDraft ? 'consent.resumeP1DBody' : 'consent.body')}</Text>
        {p1dDraft ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, padding: space.md, backgroundColor: colors.blueSoft, borderRadius: radius.md }}>
            <Icon name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={[type.caption, { color: colors.text, flex: 1 }]}>{t('consent.resumeP1DNotice')}</Text>
          </View>
        ) : null}
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
      <Button label={busy || recoveringP1D ? t('common.loading') : t('consent.submit')} onPress={submit} disabled={busy || recoveringP1D || !choices.terms} arrow />
    </Screen>
  );
}
