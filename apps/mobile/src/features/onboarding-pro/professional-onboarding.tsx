import { professionalOnboardingSchema, type ProfessionalOnboarding } from '@meraceo/shared';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
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
  dayOptions,
  employmentOptions,
  engagementOptions,
  expertiseOptions,
  feeOptions,
  formatOptions,
  industryOptions,
  qualificationOptions,
} from '@/features/onboarding/options';
import { PhotoField } from '@/features/onboarding/photo-field';
import { ReviewCard } from '@/features/onboarding/review-card';
import { SkillsField } from '@/features/onboarding/skills-field';
import { cleanDraft, errorsFor, placeLine, toNumber } from '@/features/onboarding/wizard-utils';
import { api } from '@/lib/api';
import { t } from '@/i18n';

// The review step needs ticks, so the draft holds booleans (the schema demands true at submit). photoKey and
// photoUri belong to the optional profile photo: where it is stored, and a local preview.
type Draft = Partial<Omit<ProfessionalOnboarding, 'disclaimerAccepted' | 'termsAccepted'>> & {
  disclaimerAccepted?: boolean;
  termsAccepted?: boolean;
  photoKey?: string;
  photoUri?: string;
};

// Each step: its title, its one-line hint, and the fields that must be valid before moving on.
const STEPS = [
  { title: 'pro.stepPersonal', hint: 'onboarding.hint.proYou', fields: ['name', 'country', 'state', 'city'] },
  { title: 'pro.stepContact', hint: 'onboarding.hint.proContact', fields: ['phone', 'linkedin', 'qualification'] },
  { title: 'pro.stepExperience2', hint: 'onboarding.hint.proExp', fields: ['headline', 'designation', 'company', 'yearsExperience', 'employmentType'] },
  { title: 'pro.stepBackground', hint: 'onboarding.hint.proBackground', fields: ['industry', 'experience', 'workHistory', 'skills'] },
  { title: 'pro.stepFee', hint: 'onboarding.hint.proFee', fields: ['expertise', 'feeBand', 'formats'] },
  { title: 'pro.stepAvailability', hint: 'onboarding.hint.proAvail', fields: ['engagementType', 'days', 'timeSlots'] },
  { title: 'pro.stepReview', hint: 'onboarding.hint.pro4', fields: ['disclaimerAccepted', 'termsAccepted'] },
] as const;

// Professional onboarding (W3-02 UI, W3-03 validation). Every step fits one screen and scrolls only if it must.
// The draft stays on the device while filling in; the finished form is saved to the server (W3-05).
// With `initial` it edits an already saved profile: it starts from those answers and does not touch the on-device draft.
export function ProfessionalOnboardingFlow({ onComplete, initial }: { onComplete: () => void; initial?: Draft }) {
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
    progress.getDraft<Draft>('professional').then((saved) => {
      if (saved) setDraft(saved);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merge a change into the draft and save it on the device straight away.
  function update(patch: Draft) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (!initial) void progress.setDraft('professional', next);
  }

  // Validation problems for the current draft. Optional boxes left empty count as "not given".
  function issuesNow() {
    return professionalOnboardingSchema.safeParse(cleanDraft(draft)).error?.issues ?? [];
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
    const result = professionalOnboardingSchema.safeParse(cleanDraft(draft));
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
      // The photo was uploaded earlier in this flow. Saving it on the profile is a nice-to-have, so a failure here is ignored.
      if (!initial && draft.photoKey) await api.savePhoto(token, draft.photoKey).catch(() => undefined);
      if (!initial) await progress.clearDraft('professional');
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
  // A small helper for the pick-from-a-list fields.
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
                {/* Editing happens from the Profile tab, which has its own photo button */}
                {!initial ? <PhotoField kind="photo" name={draft.name ?? ''} uri={draft.photoUri} onPicked={(photoKey, photoUri) => update({ photoKey, photoUri })} /> : null}
                <Input label={t('pro.name')} value={draft.name ?? ''} onChangeText={(v) => update({ name: v })} error={errors.name} />
                <LocationFields value={draft} onChange={update} errors={errors} />
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Input label={t('common.phone')} value={draft.phone ?? ''} onChangeText={(v) => update({ phone: v })} keyboardType="phone-pad" error={errors.phone} />
                <Input label={t('common.linkedin')} value={draft.linkedin ?? ''} onChangeText={(v) => update({ linkedin: v })} keyboardType="url" autoCapitalize="none" error={errors.linkedin} />
                {pick(t('common.qualification'), qualificationOptions(), draft.qualification, 'qualification', true)}
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Input label={t('pro.headline')} placeholder={t('pro.headlineExample')} value={draft.headline ?? ''} onChangeText={(v) => update({ headline: v })} error={errors.headline} />
                <Input label={t('pro.designation')} value={draft.designation ?? ''} onChangeText={(v) => update({ designation: v })} error={errors.designation} />
                <Input label={t('pro.company')} value={draft.company ?? ''} onChangeText={(v) => update({ company: v })} error={errors.company} />
                <Input label={t('pro.yearsExperience')} value={draft.yearsExperience?.toString() ?? ''} onChangeText={(v) => update({ yearsExperience: toNumber(v) })} keyboardType="numeric" error={errors.yearsExperience} />
                {pick(t('pro.employmentType'), employmentOptions(), draft.employmentType, 'employmentType')}
              </>
            ) : null}

            {step === 3 ? (
              <>
                {pick(t('pro.industry'), industryOptions(), draft.industry, 'industry', true)}
                <Input label={t('pro.experience')} helper={t('pro.experienceHelp')} value={draft.experience ?? ''} onChangeText={(v) => update({ experience: v })} multiline error={errors.experience} />
                <Input label={t('pro.workHistory')} value={draft.workHistory ?? ''} onChangeText={(v) => update({ workHistory: v })} multiline error={errors.workHistory} />
                <SkillsField value={draft.skills ?? []} onChange={(skills) => update({ skills })} error={errors.skills} />
              </>
            ) : null}

            {step === 4 ? (
              <>
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.expertise')}</Text>
                <OptionChips multi options={expertiseOptions()} selected={draft.expertise ?? []} onChange={(v) => update({ expertise: v })} />
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.feeBand')}</Text>
                <OptionChips options={feeOptions()} selected={draft.feeBand ? [draft.feeBand] : []} onChange={([v]) => update({ feeBand: v })} />
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.formats')}</Text>
                <OptionChips multi options={formatOptions()} selected={draft.formats ?? []} onChange={(v) => update({ formats: v })} />
              </>
            ) : null}

            {step === 5 ? (
              <>
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.engagementType')}</Text>
                <OptionChips options={engagementOptions()} selected={draft.engagementType ? [draft.engagementType] : []} onChange={([v]) => update({ engagementType: v })} />
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.days')}</Text>
                <OptionChips multi options={dayOptions()} selected={draft.days ?? []} onChange={(v) => update({ days: v })} />
                <Input label={t('pro.timeSlots')} value={draft.timeSlots ?? ''} onChangeText={(v) => update({ timeSlots: v })} error={errors.timeSlots} />
              </>
            ) : null}

            {step === 6 ? (
              <>
                <ReviewCard
                  onEdit={setStep}
                  rows={[
                    { label: t('pro.name'), value: draft.name ?? '', step: 0 },
                    { label: t('location.place'), value: placeLine(draft), step: 0 },
                    { label: t('common.qualification'), value: draft.qualification ? t(`opt.qualification.${draft.qualification}`) : '', step: 1 },
                    { label: t('pro.headline'), value: draft.headline ?? '', step: 2 },
                    { label: t('pro.company'), value: draft.company ?? '', step: 2 },
                    { label: t('pro.skills'), value: (draft.skills ?? []).join(', '), step: 3 },
                    { label: t('pro.feeBand'), value: draft.feeBand ? t(`fee.${draft.feeBand}`) : '', step: 4 },
                    { label: t('pro.days'), value: (draft.days ?? []).map((d) => t(`opt.day.${d}`)).join(', '), step: 5 },
                  ]}
                />
                <Checkbox label={t('pro.disclaimer')} checked={draft.disclaimerAccepted === true} onChange={(v) => update({ disclaimerAccepted: v })} />
                <Checkbox label={t('pro.terms')} checked={draft.termsAccepted === true} onChange={(v) => update({ termsAccepted: v })} />
              </>
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
            <Button label={isLast ? (initial ? t('common.save') : t('pro.submit')) : t('common.next')} onPress={isLast ? finish : next} disabled={!stepComplete || saving} arrow={!isLast} />
          </View>
        </View>
        {saveError ? <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{t('onboarding.saveFailed')}</Text> : null}
      </View>
    </Screen>
  );
}
