import { ownerOnboardingSchema, type OwnerOnboarding } from '@meraceo/shared';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { LocationFields } from '@/components/location-fields';
import { OptionChips } from '@/components/option-chips';
import { Screen } from '@/components/screen';
import { ScrollBody } from '@/components/scroll-body';
import { SelectField } from '@/components/select-field';
import { StepIndicator } from '@/components/step-indicator';
import { useTheme } from '@/components/use-theme';
import { progress } from '@/features/auth/progress-store';
import { useSession } from '@/features/auth/session-provider';
import {
  businessTypeOptions,
  expertiseOptions,
  feeOptions,
  formatOptions,
  industryOptions,
  qualificationOptions,
  registrationOptions,
  revenueOptions,
  sectorOptions,
  teamSizeOptions,
} from '@/features/onboarding/options';
import { PhotoField } from '@/features/onboarding/photo-field';
import { ReviewCard } from '@/features/onboarding/review-card';
import { cleanDraft, errorsFor, placeLine, toNumber } from '@/features/onboarding/wizard-utils';
import { api } from '@/lib/api';
import { t } from '@/i18n';

// The answers so far. photoKey and photoUri belong to the optional logo: where it is stored, and a local preview.
type Draft = Partial<OwnerOnboarding> & { photoKey?: string; photoUri?: string };

// Each step: its title, its one-line hint, and the fields that must be valid before moving on.
const STEPS = [
  { title: 'owner.stepBusiness', hint: 'onboarding.hint.owner0', fields: ['businessName', 'industry', 'businessType', 'registrationType'] },
  { title: 'owner.stepAbout', hint: 'onboarding.hint.ownerAbout', fields: ['description', 'sector', 'yearEstablished', 'website'] },
  { title: 'owner.stepSize', hint: 'onboarding.hint.ownerSize', fields: ['country', 'state', 'city', 'revenue', 'teamSize'] },
  { title: 'owner.stepYou', hint: 'onboarding.hint.ownerYou', fields: ['ownerName', 'designation', 'yearsInBusiness'] },
  { title: 'owner.stepContact', hint: 'onboarding.hint.ownerContact', fields: ['phone', 'linkedin', 'qualification'] },
  { title: 'owner.stepNeeds', hint: 'onboarding.hint.owner3', fields: ['needTitle', 'challenge', 'needExpertise'] },
  { title: 'owner.stepPrefs', hint: 'onboarding.hint.ownerPrefs', fields: ['goals', 'budgetBand', 'preferredFormat'] },
  { title: 'owner.stepReview', hint: 'onboarding.hint.owner4', fields: [] },
] as const;

// Owner onboarding (W3-01 UI, W3-03 validation). Every step fits one screen and scrolls only if it must.
// The draft stays on the device while filling in; the finished form is saved to the server (W3-05).
// With `initial` it edits an already saved profile: it starts from those answers and does not touch the on-device draft.
export function OwnerOnboardingFlow({ onComplete, initial }: { onComplete: () => void; initial?: Draft }) {
  const { colors, space, type } = useTheme();
  const [draft, setDraft] = useState<Draft>({});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const { token, refresh } = useSession();
  // True while the answers are being sent; saveError shows when sending fails.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Load the answers to start from: the saved profile when editing, otherwise any draft kept on the device.
  useEffect(() => {
    if (initial) {
      setDraft(initial);
      setLoaded(true);
      return;
    }
    progress.getDraft<Draft>('owner').then((saved) => {
      if (saved) setDraft(saved);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merge a change into the draft and save it on the device straight away.
  function update(patch: Draft) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (!initial) void progress.setDraft('owner', next);
  }

  // Validation problems for the current draft. Optional boxes left empty count as "not given".
  function issuesNow() {
    return ownerOnboardingSchema.safeParse(cleanDraft(draft)).error?.issues ?? [];
  }

  // Check the current step, then move on if it is valid.
  function next() {
    const found = errorsFor(issuesNow(), STEPS[step]!.fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setStep(step + 1);
  }

  // Check the whole form, jump back to the first problem, or save it to the server and finish.
  async function finish() {
    const result = ownerOnboardingSchema.safeParse(cleanDraft(draft));
    if (!result.success) {
      const all = errorsFor(result.error.issues, STEPS.flatMap((s) => s.fields));
      setErrors(all);
      setStep(Math.max(0, STEPS.findIndex((s) => s.fields.some((f) => all[f]))));
      return;
    }
    if (!token) return;
    setSaving(true);
    setSaveError(false);
    try {
      await api.saveProfile(token, result.data);
      // The logo was uploaded earlier in this flow. Saving it on the profile is a nice-to-have, so a failure here is ignored.
      if (!initial && draft.photoKey) await api.savePhoto(token, draft.photoKey).catch(() => undefined);
      if (!initial) await progress.clearDraft('owner');
      await refresh();
      onComplete();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;
  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  // Next stays grey until every field on this step is filled in correctly.
  const stepComplete = Object.keys(errorsFor(issuesNow(), current.fields)).length === 0;
  // A small helper for the many pick-from-a-list fields.
  const pick = <T extends string>(label: string, options: { value: T; label: string }[], value: T | undefined, key: keyof Draft, searchable = false) => (
    <SelectField label={label} placeholder={t('common.select2')} options={options} value={value} searchable={searchable} onChange={(v) => update({ [key]: v } as Draft)} error={errors[key as string]} />
  );

  return (
    <Screen scroll={false} decor={!initial}>
      <View style={{ flex: 1, gap: space.md }}>
        {/* Header: step count, progress bar, title and one-line hint */}
        <View style={{ gap: space.md }}>
          <Text style={[type.caption, { color: colors.muted }]}>{t('common.step', { current: step + 1, total: STEPS.length })}</Text>
          <View style={{ marginVertical: space.md }}>
            <StepIndicator current={step + 1} total={STEPS.length} />
          </View>
          <View style={{ gap: space.xs, marginTop: space.sm }}>
            <Text style={[type.title, { color: colors.text }]}>{t(current.title)}</Text>
            <Text style={[type.body, { color: colors.muted }]}>{t(current.hint)}</Text>
          </View>
        </View>

        {/* Body: the fields for this step. It scrolls when a step has more fields than fit, while the buttons below stay pinned. */}
        <ScrollBody>
          <View style={{ gap: space.md }}>
            {step === 0 ? (
              <>
                {/* Editing happens from the Account tab, which has its own logo button */}
                {!initial ? <PhotoField kind="logo" name={draft.businessName ?? ''} uri={draft.photoUri} onPicked={(photoKey, photoUri) => update({ photoKey, photoUri })} /> : null}
                <Input label={t('owner.businessName')} value={draft.businessName ?? ''} onChangeText={(v) => update({ businessName: v })} error={errors.businessName} />
                {pick(t('owner.industry'), industryOptions(), draft.industry, 'industry', true)}
                {pick(t('owner.businessType'), businessTypeOptions(), draft.businessType, 'businessType')}
                {pick(t('owner.registrationType'), registrationOptions(), draft.registrationType, 'registrationType')}
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Input label={t('owner.description')} value={draft.description ?? ''} onChangeText={(v) => update({ description: v })} multiline error={errors.description} />
                {pick(t('owner.sector'), sectorOptions(), draft.sector, 'sector')}
                <Input label={t('owner.yearEstablished')} value={draft.yearEstablished ?? ''} onChangeText={(v) => update({ yearEstablished: v.replace(/\D/g, '').slice(0, 4) })} keyboardType="numeric" error={errors.yearEstablished} />
                <Input label={t('owner.website')} value={draft.website ?? ''} onChangeText={(v) => update({ website: v })} keyboardType="url" autoCapitalize="none" error={errors.website} />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <LocationFields value={draft} onChange={update} errors={errors} />
                {pick(t('owner.revenue'), revenueOptions(), draft.revenue, 'revenue')}
                {pick(t('owner.teamSize'), teamSizeOptions(), draft.teamSize, 'teamSize')}
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Input label={t('owner.ownerName')} value={draft.ownerName ?? ''} onChangeText={(v) => update({ ownerName: v })} error={errors.ownerName} />
                <Input label={t('owner.designation')} value={draft.designation ?? ''} onChangeText={(v) => update({ designation: v })} error={errors.designation} />
                <Input label={t('owner.yearsInBusiness')} value={draft.yearsInBusiness?.toString() ?? ''} onChangeText={(v) => update({ yearsInBusiness: toNumber(v) })} keyboardType="numeric" error={errors.yearsInBusiness} />
              </>
            ) : null}

            {step === 4 ? (
              <>
                <Input label={t('common.phone')} value={draft.phone ?? ''} onChangeText={(v) => update({ phone: v })} keyboardType="phone-pad" error={errors.phone} />
                <Input label={t('common.linkedin')} value={draft.linkedin ?? ''} onChangeText={(v) => update({ linkedin: v })} keyboardType="url" autoCapitalize="none" error={errors.linkedin} />
                {pick(t('common.qualificationOptional'), qualificationOptions(), draft.qualification, 'qualification', true)}
              </>
            ) : null}

            {step === 5 ? (
              <>
                <Input label={t('owner.needTitle')} value={draft.needTitle ?? ''} onChangeText={(v) => update({ needTitle: v })} error={errors.needTitle} />
                <Input label={t('owner.challenge')} value={draft.challenge ?? ''} onChangeText={(v) => update({ challenge: v })} multiline error={errors.challenge} />
                <Text style={[type.caption, { color: colors.muted }]}>{t('owner.needExpertise')}</Text>
                <OptionChips multi options={expertiseOptions()} selected={draft.needExpertise ?? []} onChange={(v) => update({ needExpertise: v })} />
              </>
            ) : null}

            {step === 6 ? (
              <>
                <Input label={t('owner.goals')} value={draft.goals ?? ''} onChangeText={(v) => update({ goals: v })} multiline error={errors.goals} />
                <Text style={[type.caption, { color: colors.muted }]}>{t('owner.budget')}</Text>
                <OptionChips options={feeOptions()} selected={draft.budgetBand ? [draft.budgetBand] : []} onChange={([v]) => update({ budgetBand: v })} />
                <Text style={[type.caption, { color: colors.muted }]}>{t('owner.format')}</Text>
                <OptionChips options={formatOptions()} selected={draft.preferredFormat ? [draft.preferredFormat] : []} onChange={([v]) => update({ preferredFormat: v })} />
              </>
            ) : null}

            {step === 7 ? (
              <ReviewCard
                onEdit={setStep}
                rows={[
                  { label: t('owner.businessName'), value: draft.businessName ?? '', step: 0 },
                  { label: t('owner.industry'), value: draft.industry ? t(`industry.${draft.industry}`) : '', step: 0 },
                  { label: t('owner.businessType'), value: draft.businessType ? t(`opt.businessType.${draft.businessType}`) : '', step: 0 },
                  { label: t('owner.description'), value: draft.description ?? '', step: 1 },
                  { label: t('location.place'), value: placeLine(draft), step: 2 },
                  { label: t('owner.revenue'), value: draft.revenue ? t(`opt.revenue.${draft.revenue}`) : '', step: 2 },
                  { label: t('owner.ownerName'), value: draft.ownerName ?? '', step: 3 },
                  { label: t('owner.designation'), value: draft.designation ?? '', step: 3 },
                  { label: t('owner.needTitle'), value: draft.needTitle ?? '', step: 5 },
                  { label: t('owner.budget'), value: draft.budgetBand ? t(`fee.${draft.budgetBand}`) : '', step: 6 },
                ]}
              />
            ) : null}
          </View>
        </ScrollBody>

        {!stepComplete ? (
          <Text style={[type.caption, { color: colors.muted, textAlign: 'center' }]}>{t('onboarding.finishToContinue')}</Text>
        ) : null}

        {/* Footer: Back and Next side by side */}
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          {step > 0 ? (
            <View key="back" style={{ flex: 1 }}>
              <Button label={t('common.back')} variant="secondary" onPress={() => setStep(step - 1)} />
            </View>
          ) : null}
          <View key="next" style={{ flex: step > 0 ? 2 : 1 }}>
            <Button label={isLast ? (initial ? t('common.save') : t('owner.submit')) : t('common.next')} onPress={isLast ? finish : next} disabled={!stepComplete || saving} arrow={!isLast} />
          </View>
        </View>
        {saveError ? <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{t('onboarding.saveFailed')}</Text> : null}
      </View>
    </Screen>
  );
}
