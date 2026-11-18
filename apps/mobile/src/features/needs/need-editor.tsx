import { createNeedSchema, isDuplicateOpenNeed, matchingOpenNeedExpertise, type CreateNeedInput } from '@meraceo/shared';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { OptionChips } from '@/components/option-chips';
import { SelectField } from '@/components/select-field';
import { useTheme } from '@/components/use-theme';
import { expertiseOptions, feeOptions, formatOptions, industryOptions } from '@/features/onboarding/options';
import { cleanDraft, errorsFor } from '@/features/onboarding/wizard-utils';
import { t } from '@/i18n';
import { ApiError, type Need } from '@/lib/api';

const FIELDS = ['title', 'challenge', 'timeline', 'goals', 'expertise', 'industry', 'budgetBand', 'format'];

// Shared create/edit form keeps both owner need writes on the same contract.
export function NeedEditor({ initial, existingNeeds, excludeNeedId, onSave, editing = false }: { initial: Partial<CreateNeedInput>; existingNeeds: readonly Need[]; excludeNeedId?: string; onSave: (input: CreateNeedInput) => Promise<void>; editing?: boolean }) {
  const { colors, space, type } = useTheme();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [serverDuplicate, setServerDuplicate] = useState(false);
  const saving = useRef(false);
  const duplicate = serverDuplicate || isDuplicateOpenNeed(draft, existingNeeds, excludeNeedId);
  const alreadyUsedExpertise = matchingOpenNeedExpertise(draft, existingNeeds, excludeNeedId) as CreateNeedInput['expertise'];

  function updateDraft(patch: Partial<CreateNeedInput>) {
    setDraft((current) => ({ ...current, ...patch }));
    setServerDuplicate(false);
  }

  // Validate before writing and keep the draft intact on a recoverable failure.
  async function save() {
    if (saving.current) return;
    const result = createNeedSchema.safeParse(cleanDraft(draft));
    if (!result.success) {
      setErrors(errorsFor(result.error.issues, FIELDS));
      return;
    }
    saving.current = true;
    setBusy(true);
    setFailed(false);
    setErrors({});
    try { await onSave(result.data); }
    catch (error) {
      if (error instanceof ApiError && error.code === 'duplicate_need') setServerDuplicate(true);
      else setFailed(true);
    }
    finally { saving.current = false; setBusy(false); }
  }

  const error = (key: string) => errors[key] ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{errors[key]}</Text> : null;
  return (
    <View style={{ gap: space.md }}>
      <Input label={t('owner.needTitle')} value={draft.title ?? ''} onChangeText={(title) => updateDraft({ title })} maxLength={120} error={errors.title} />
      <Input label={t('owner.challenge')} value={draft.challenge ?? ''} onChangeText={(challenge) => updateDraft({ challenge })} multiline maxLength={500} helper={`${draft.challenge?.length ?? 0}/500`} error={errors.challenge} />
      <Input label={t('need.timeline')} value={draft.timeline ?? ''} onChangeText={(timeline) => updateDraft({ timeline })} maxLength={120} error={errors.timeline} />
      <Input label={t('owner.goals')} value={draft.goals ?? ''} onChangeText={(goals) => updateDraft({ goals })} multiline maxLength={500} helper={`${draft.goals?.length ?? 0}/500`} error={errors.goals} />
      <Text style={[type.caption, { color: colors.muted }]}>{t('owner.needExpertise')}</Text>
      <OptionChips multi maxSelected={5} options={expertiseOptions()} selected={draft.expertise ?? []} disabledValues={alreadyUsedExpertise} onChange={(expertise) => updateDraft({ expertise })} />
      {alreadyUsedExpertise.length > 0 ? <Text style={[type.caption, { color: colors.muted }]}>{t('need.expertiseAlreadyUsed')}</Text> : null}
      {error('expertise')}
      <SelectField label={t('owner.industry')} placeholder={t('common.select')} options={industryOptions()} value={draft.industry} onChange={(industry) => updateDraft({ industry })} error={errors.industry} />
      <Text style={[type.caption, { color: colors.muted }]}>{t('need.optionalBudget')}</Text>
      <OptionChips options={[{ value: '', label: t('need.noBudget') }, ...feeOptions()]} selected={[draft.budgetBand ?? '']} onChange={([budget]) => updateDraft({ budgetBand: budget ? budget as CreateNeedInput['budgetBand'] : undefined })} />
      {error('budgetBand')}
      <Text style={[type.caption, { color: colors.muted }]}>{t('owner.format')}</Text>
      <OptionChips options={formatOptions()} selected={draft.format ? [draft.format] : []} onChange={([format]) => updateDraft({ format })} />
      {error('format')}
      {duplicate ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{t('need.duplicate')}</Text> : null}
      {failed ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{t(editing ? 'need.editFailed' : 'need.postFailed')}</Text> : null}
      <Button label={t(editing ? 'need.save' : 'need.post')} onPress={save} disabled={busy || duplicate} />
    </View>
  );
}
