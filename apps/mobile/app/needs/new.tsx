import { createNeedSchema, type CreateNeedInput } from '@meraceo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { OptionChips } from '@/components/option-chips';
import { Screen } from '@/components/screen';
import { SelectField } from '@/components/select-field';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { expertiseOptions, feeOptions, formatOptions, industryOptions } from '@/features/onboarding/options';
import { cleanDraft, errorsFor } from '@/features/onboarding/wizard-utils';
import { api } from '@/lib/api';
import { t } from '@/i18n';

const FIELDS = ['title', 'challenge', 'goals', 'expertise', 'industry', 'budgetBand', 'format'];

// Post another need. The industry starts as the one from the owner's business and can be changed.
export default function NewNeed() {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { token } = useSession();
  const [draft, setDraft] = useState<Partial<CreateNeedInput>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Start with the industry from the owner's own profile.
  useEffect(() => {
    if (!token) return;
    api
      .getProfile(token)
      .then((p) => setDraft((d) => ({ industry: p.data.industry as CreateNeedInput['industry'], ...d })))
      .catch(() => undefined);
  }, [token]);

  // Check the form, send it, and open the matches for the new need.
  async function post() {
    const result = createNeedSchema.safeParse(cleanDraft(draft));
    if (!result.success) {
      setErrors(errorsFor(result.error.issues, FIELDS));
      return;
    }
    if (!token) return;
    setErrors({});
    setBusy(true);
    setFailed(false);
    try {
      const need = await api.createNeed(token, result.data);
      router.replace(`/needs/${need.id}` as never);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back>
      <View style={{ gap: space.xs }}>
        <Text style={[type.title, { color: colors.text }]}>{t('need.newTitle')}</Text>
        <Text style={[type.body, { color: colors.muted }]}>{t('need.newSubtitle')}</Text>
      </View>

      <View style={{ gap: space.md }}>
        <Input label={t('owner.needTitle')} value={draft.title ?? ''} onChangeText={(v) => setDraft({ ...draft, title: v })} error={errors.title} />
        <Input label={t('owner.challenge')} value={draft.challenge ?? ''} onChangeText={(v) => setDraft({ ...draft, challenge: v })} multiline error={errors.challenge} />
        <Input label={t('owner.goals')} value={draft.goals ?? ''} onChangeText={(v) => setDraft({ ...draft, goals: v })} multiline error={errors.goals} />
        <Text style={[type.caption, { color: colors.muted }]}>{t('owner.needExpertise')}</Text>
        <OptionChips multi options={expertiseOptions()} selected={draft.expertise ?? []} onChange={(v) => setDraft({ ...draft, expertise: v })} />
        <SelectField label={t('owner.industry')} placeholder={t('common.select')} options={industryOptions()} value={draft.industry} onChange={(v) => setDraft({ ...draft, industry: v })} error={errors.industry} />
        <Text style={[type.caption, { color: colors.muted }]}>{t('owner.budget')}</Text>
        <OptionChips options={feeOptions()} selected={draft.budgetBand ? [draft.budgetBand] : []} onChange={(v) => setDraft({ ...draft, budgetBand: v[v.length - 1] })} />
        <Text style={[type.caption, { color: colors.muted }]}>{t('owner.format')}</Text>
        <OptionChips options={formatOptions()} selected={draft.format ? [draft.format] : []} onChange={(v) => setDraft({ ...draft, format: v[v.length - 1] })} />
      </View>

      {failed ? <Text style={[type.caption, { color: colors.danger }]}>{t('need.postFailed')}</Text> : null}
      <Button label={t('need.post')} onPress={post} disabled={busy} />
    </Screen>
  );
}
