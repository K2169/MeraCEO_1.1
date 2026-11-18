import { GENDER_OPTIONS, ownerOnboardingSchema, ownerRegistrationSchema, type OwnerOnboarding } from '@meraceo/shared';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Checkbox } from '@/components/checkbox';
import { Button } from '@/components/button';
import { DateOfBirthPicker } from '@/components/date-of-birth-picker';
import { Input } from '@/components/input';
import { LocationFields } from '@/components/location-fields';
import { OptionChips } from '@/components/option-chips';
import { Screen } from '@/components/screen';
import { ScrollBody } from '@/components/scroll-body';
import { SelectField } from '@/components/select-field';
import { OnboardingStepper } from '@/components/onboarding-stepper';
import { useTheme } from '@/components/use-theme';
import { progress } from '@/features/auth/progress-store';
import { toIsoDate } from '@/features/auth/date-of-birth';
import { clearDateOfBirthDraft, getDateOfBirthDraft, saveDateOfBirthDraft } from '@/features/auth/date-of-birth-draft';
import { consentChoiceSignature, newConsentIdempotencyKey } from '@/features/auth/consent-idempotency';
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
import { cleanDraft, errorsFor, toNumber } from '@/features/onboarding/wizard-utils';
import { api, ApiError } from '@/lib/api';
import { t } from '@/i18n';

// The answers so far. photoKey and photoUri belong to the optional logo: where it is stored, and a local preview.
type Draft = Partial<OwnerOnboarding> & {
  photoKey?: string;
  photoUri?: string;
  termsAccepted?: boolean;
  consentChoices?: { matching?: boolean; contact_sharing?: boolean; notifications?: boolean };
  consentIdempotencyKey?: string;
  consentIdempotencyChoiceSignature?: string;
};
const supportBudgetOptions = () => ['below_5000', '5000_25000', '25000_100000', 'above_100000'].map((value) => ({ value: value as NonNullable<OwnerOnboarding['supportBudgets']>[number]['budget'], label: t(`budget.${value}`) }));

// Each step: its title, its one-line hint, and the fields that must be valid before moving on.
const STEPS = [
  { id: 'S1A', stage: 'owner.stepBusiness', title: 'owner.stepBusiness', hint: 'onboarding.hint.owner0', fields: ['businessName', 'industry', 'businessType', 'registrationType', 'description', 'sector', 'yearEstablished', 'website', 'country', 'state', 'city', 'revenue', 'teamSize'] },
  { id: 'S1B', stage: 'owner.stepYou', title: 'owner.stepYou', hint: 'onboarding.hint.ownerYou', fields: ['ownerName', 'gender', 'designation', 'yearsInBusiness', 'phone', 'linkedin', 'qualification', 'ownerBio'] },
  { id: 'S1C', stage: 'owner.stepNeeds', title: 'owner.stepNeeds', hint: 'onboarding.hint.owner3', fields: ['needTitle', 'challenge', 'needExpertise', 'goals', 'budgetBand', 'preferredFormat', 'needTimeline', 'supportBudgets'] },
  { id: 'S1D', stage: 'owner.stepReview', title: 'owner.stepReview', hint: 'onboarding.hint.owner4', fields: ['termsAccepted'] },
] as const;

// Owner onboarding (W3-01 UI, W3-03 validation). Every step fits one screen and scrolls only if it must.
// The draft stays on the device while filling in; the finished form is saved to the server (W3-05).
// With `initial` it edits an already saved profile: it starts from those answers and does not touch the on-device draft.
export function OwnerOnboardingFlow({ onComplete, initial }: { onComplete: () => void; initial?: Draft }) {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [ageError, setAgeError] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [step, setStep] = useState(0);
  const [furthestUnlocked, setFurthestUnlocked] = useState(0);
  const [returnToReview, setReturnToReview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { token, user, refresh } = useSession();
  // True while the answers are being sent; saveError shows when sending fails.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Load the answers to start from: the saved profile when editing, otherwise any draft kept on the device.
  useEffect(() => {
    setLoadFailed(false);
    if (initial) {
      setDraft(initial);
      setLoaded(true);
      return;
    }
    Promise.all([
      progress.getDraft<Draft>('owner', user?.id),
      user?.id ? getDateOfBirthDraft(user.id) : Promise.resolve(null),
    ]).then(([saved, savedDob]) => {
      const next = { ...(saved ?? {}) };
      if (!next.ownerName?.trim() && user?.name?.trim()) next.ownerName = user.name.trim();
      const ageCheckIsComplete = user?.ageConfirmed === true && user.dateOfBirthSet === true;
      if (!ageCheckIsComplete && savedDob) setDateOfBirth(savedDob);
      if (ageCheckIsComplete && savedDob && user?.id) void clearDateOfBirthDraft(user.id);
      setDraft(next);
      if (!saved?.ownerName?.trim() && next.ownerName) void progress.setDraft('owner', next, user?.id);
      setLoaded(true);
    }).catch(() => setLoadFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAttempt]);

  // Merge a change into the draft and save it on the device straight away.
  function update(patch: Draft) {
    const next = { ...draft, ...patch };
    if ('consentChoices' in patch && consentChoiceSignature(next.consentChoices) !== consentChoiceSignature(draft.consentChoices)) {
      next.consentIdempotencyKey = undefined;
      next.consentIdempotencyChoiceSignature = undefined;
    }
    setDraft(next);
    if (!initial) void progress.setDraft('owner', next, user?.id);
  }

  // Validation problems for the current draft. Optional boxes left empty count as "not given".
  function issuesNow() {
    return (initial ? ownerOnboardingSchema : ownerRegistrationSchema).safeParse(cleanDraft(draft)).error?.issues ?? [];
  }

  // Legacy profiles may omit detailed budgets; new registrations must cover every selected area.
  function registrationErrors() {
    const found: Record<string, string> = {};
    if (!initial && !draft.goals?.trim()) found.goals = t('common.requiredField');
    if (!initial && !draft.needTimeline?.trim()) found.needTimeline = t('common.requiredField');
    if (!initial && (draft.needExpertise ?? []).some((area) => !draft.supportBudgets?.some((entry) => entry.expertise === area))) found.supportBudgets = t('common.requiredField');
    return found;
  }

  // Check the current step, then move on if it is valid.
  async function next() {
    if (saving) return;
    const found = errorsFor(issuesNow(), STEPS[step]!.fields);
    if (step === 2) Object.assign(found, registrationErrors());
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (step === 1 && !initial && !(user?.ageConfirmed === true && user.dateOfBirthSet === true)) {
      const isoDate = toIsoDate(dateOfBirth);
      if (!isoDate) {
        setAgeError(true);
        return;
      }
      if (!token || !user?.id) return;
      setSaving(true);
      setSaveError(false);
      try {
        await saveDateOfBirthDraft(user.id, dateOfBirth);
        const checked = await api.setAge(token, isoDate);
        await clearDateOfBirthDraft(user.id);
        if (checked.ageConfirmed !== true) {
          await refresh();
          router.replace('/age-blocked' as Href);
          return;
        }
        if (!checked.role) {
          try {
            await api.setRole(token, 'owner');
          } catch (err) {
            if (!(err instanceof ApiError && err.status === 409)) throw err;
          }
        }
        const account = await api.getMe(token);
        await refresh();
        setDateOfBirth('');
        if (account.role !== 'owner') {
          router.replace('/' as Href);
          return;
        }
      } catch {
        setSaveError(true);
        return;
      } finally {
        setSaving(false);
      }
    }
    setFurthestUnlocked((value) => Math.max(value, step + 1));
    if (returnToReview) {
      setReturnToReview(false);
      setStep(3);
    } else setStep(step + 1);
  }

  // Check the whole form, jump back to the first problem, or save it to the server and finish.
  async function finish() {
    if (saving) return;
    const result = (initial ? ownerOnboardingSchema : ownerRegistrationSchema).safeParse(cleanDraft(draft));
    const additional = registrationErrors();
    if (!initial && !draft.termsAccepted) additional.termsAccepted = t('common.requiredField');
    if (!result.success || Object.keys(additional).length) {
      const all = { ...(!result.success ? errorsFor(result.error.issues, STEPS.flatMap((s) => s.fields)) : {}), ...additional };
      setErrors(all);
      setReturnToReview(true);
      setStep(Math.max(0, STEPS.findIndex((s) => s.fields.some((f) => all[f]))));
      return;
    }
    if (!token || !user?.id || !result.success) return;
    setSaving(true);
    setSaveError(false);
    try {
      const choices = draft.consentChoices ?? {};
      const signature = consentChoiceSignature(choices);
      const consentKey = draft.consentIdempotencyKey && draft.consentIdempotencyChoiceSignature === signature ? draft.consentIdempotencyKey : newConsentIdempotencyKey();
      if (!initial) {
        const withKey = { ...draft, consentIdempotencyKey: consentKey, consentIdempotencyChoiceSignature: signature };
        setDraft(withKey);
        await progress.setDraft('owner', withKey, user.id);
      }
      await api.saveProfile(token, result.data);
      // The logo was uploaded earlier in this flow. Saving it on the profile is a nice-to-have, so a failure here is ignored.
      if (!initial && draft.photoKey) await api.savePhoto(token, draft.photoKey).catch(() => undefined);
      if (!initial) {
        await api.recordConsents(token, [
          { type: 'matching', granted: choices.matching === true },
          { type: 'contact_sharing', granted: choices.contact_sharing === true },
          { type: 'notifications', granted: choices.notifications === true },
          { type: 'terms', granted: true },
        ], consentKey);
        await progress.clearDraft('owner', user?.id);
        if (user?.id) await clearDateOfBirthDraft(user.id);
      }
      await refresh();
      onComplete();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <Screen scroll={false}>{loadFailed ? <View style={{ gap: space.md }}><Text accessibilityRole="alert" style={[type.body, { color: colors.danger }]}>{t('common.genericError')}</Text><Button label={t('common.retry')} onPress={() => setLoadAttempt((value) => value + 1)} /></View> : <ActivityIndicator color={colors.primary} />}</Screen>;
  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  // A small helper for the many pick-from-a-list fields.
  const pick = <T extends string>(label: string, options: { value: T; label: string }[], value: T | undefined, key: keyof Draft, searchable = false) => (
    <SelectField label={label} placeholder={t('common.select2')} options={options} value={value} searchable={searchable} onChange={(v) => update({ [key]: v } as Draft)} error={errors[key as string]} />
  );

  return (
    <Screen scroll={false} decor={!initial}>
      <View style={{ flex: 1, gap: space.md }}>
        {/* Header: step count, progress bar, title and one-line hint */}
        <View style={{ gap: space.md }}>
          <OnboardingStepper steps={STEPS} current={step} furthestUnlocked={initial ? 3 : furthestUnlocked} disabled={saving} onSelect={(target) => {
            if (saving || (!initial && target > furthestUnlocked)) return;
            if (step === 3 && target < 3) setReturnToReview(true);
            setStep(target);
          }} />
          <View style={{ gap: space.xs, marginTop: space.sm }}>
            <Text style={[type.title, { color: colors.text }]}>{t(current.title)}</Text>
            <Text style={[type.body, { color: colors.muted }]}>{t(current.hint)}</Text>
          </View>
        </View>

        {/* Body: the fields for this step. It scrolls when a step has more fields than fit, while the buttons below stay pinned. */}
        <ScrollBody key={current.id}>
          <View style={{ gap: space.md }}>
            {current.id === 'S1A' ? (
              <>
                {/* Editing happens from the Account tab, which has its own logo button */}
                {!initial ? <PhotoField kind="logo" name={draft.businessName ?? ''} uri={draft.photoUri} onPicked={(photoKey, photoUri) => update({ photoKey, photoUri })} /> : null}
                <Input label={t('owner.businessName')} value={draft.businessName ?? ''} onChangeText={(v) => update({ businessName: v })} error={errors.businessName} />
                {pick(t('owner.industry'), industryOptions(), draft.industry, 'industry', true)}
                {pick(t('owner.businessType'), businessTypeOptions(), draft.businessType, 'businessType')}
                {pick(t('owner.registrationType'), registrationOptions(), draft.registrationType, 'registrationType')}
              </>
            ) : null}

            {current.id === 'S1A' ? (
              <>
                <Input label={t('owner.description')} maxLength={300} helper={`${draft.description?.length ?? 0}/300`} value={draft.description ?? ''} onChangeText={(v) => update({ description: v })} multiline error={errors.description} />
                {pick(t('owner.sector'), sectorOptions(), draft.sector, 'sector')}
                <Input label={t('owner.yearEstablished')} value={draft.yearEstablished ?? ''} onChangeText={(v) => update({ yearEstablished: v.replace(/\D/g, '').slice(0, 4) })} keyboardType="numeric" error={errors.yearEstablished} />
                <Input label={t('owner.website')} value={draft.website ?? ''} onChangeText={(v) => update({ website: v })} keyboardType="url" autoCapitalize="none" error={errors.website} />
              </>
            ) : null}

            {current.id === 'S1A' ? (
              <>
                <LocationFields value={draft} onChange={update} errors={errors} />
                {pick(t('owner.revenue'), revenueOptions(), draft.revenue, 'revenue')}
                {pick(t('owner.teamSize'), teamSizeOptions(), draft.teamSize, 'teamSize')}
              </>
            ) : null}

            {current.id === 'S1B' ? (
              <>
                <Input label={t('owner.ownerName')} value={draft.ownerName ?? ''} onChangeText={(v) => update({ ownerName: v })} error={errors.ownerName} />
                <SelectField label={t('common.gender')} placeholder={t('common.select2')} options={GENDER_OPTIONS.map((value) => ({ value, label: t(`gender.${value}`) }))} value={draft.gender} onChange={(gender) => update({ gender })} error={errors.gender} />
                <Input label={t('owner.designation')} value={draft.designation ?? ''} onChangeText={(v) => update({ designation: v })} error={errors.designation} />
                <Input label={t('owner.bio')} value={draft.ownerBio ?? ''} onChangeText={(ownerBio) => update({ ownerBio })} multiline maxLength={300} helper={`${draft.ownerBio?.length ?? 0}/300`} error={errors.ownerBio} />
                <Input label={t('owner.yearsInBusiness')} value={draft.yearsInBusiness?.toString() ?? ''} onChangeText={(v) => update({ yearsInBusiness: toNumber(v) })} keyboardType="numeric" error={errors.yearsInBusiness} />
                {user?.ageConfirmed === true && user.dateOfBirthSet === true ? (
                  <Text accessibilityRole="text" style={[type.caption, { color: colors.muted }]}>{t('pro.ageCheckComplete')}</Text>
                ) : !initial ? (
                  <DateOfBirthPicker
                    label={t('age.dateLabel')}
                    helper={t('age.body')}
                    value={dateOfBirth}
                    onChangeText={(value) => {
                      setDateOfBirth(value);
                      if (user?.id) void saveDateOfBirthDraft(user.id, value).catch(() => undefined);
                      setAgeError(value.length === 10 && toIsoDate(value) === null);
                    }}
                    error={ageError ? t('age.invalidDate') : undefined}
                  />
                ) : null}
              </>
            ) : null}

            {current.id === 'S1B' ? (
              <>
                {user?.email ? <Input label={t('auth.accountEmail')} value={user.email} onChangeText={() => undefined} helper={t('auth.googleEmailPrivate')} editable={false} /> : null}
                <Input label={t('common.phone')} value={draft.phone ?? ''} onChangeText={(v) => update({ phone: v })} keyboardType="phone-pad" error={errors.phone} />
                <Input label={t('common.linkedin')} value={draft.linkedin ?? ''} onChangeText={(v) => update({ linkedin: v })} keyboardType="url" autoCapitalize="none" error={errors.linkedin} />
                {pick(t('common.qualificationOptional'), qualificationOptions(), draft.qualification, 'qualification', true)}
              </>
            ) : null}

            {current.id === 'S1C' ? (
              <>
                <Input label={t('owner.needTitle')} value={draft.needTitle ?? ''} onChangeText={(v) => update({ needTitle: v })} error={errors.needTitle} />
                <Input label={t('owner.challenge')} maxLength={500} helper={`${draft.challenge?.length ?? 0}/500`} value={draft.challenge ?? ''} onChangeText={(v) => update({ challenge: v })} multiline error={errors.challenge} />
                <Text style={[type.caption, { color: colors.muted }]}>{t('owner.needExpertise')}</Text>
                <OptionChips multi maxSelected={5} options={expertiseOptions()} selected={draft.needExpertise ?? []} onChange={(v) => update({ needExpertise: v, supportBudgets: draft.supportBudgets?.filter((entry) => v.includes(entry.expertise)) })} />
                <Input label={t('owner.needTimeline')} value={draft.needTimeline ?? ''} onChangeText={(needTimeline) => update({ needTimeline })} maxLength={120} error={errors.needTimeline} />
                {(draft.needExpertise ?? []).map((area) => (
                  <SelectField key={area} label={t('owner.areaBudget', { area: t(`expertise.${area}`) })} placeholder={t('common.select2')} options={supportBudgetOptions()} value={draft.supportBudgets?.find((entry) => entry.expertise === area)?.budget} onChange={(budget) => update({ supportBudgets: [...(draft.supportBudgets ?? []).filter((entry) => entry.expertise !== area), { expertise: area, budget }] })} />
                ))}
                {errors.supportBudgets ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{errors.supportBudgets}</Text> : null}
                {errors.needExpertise ? <Text style={[type.caption, { color: colors.danger }]}>{errors.needExpertise}</Text> : null}
              </>
            ) : null}

            {current.id === 'S1C' ? (
              <>
                <Input label={t('owner.goals')} maxLength={500} helper={`${draft.goals?.length ?? 0}/500`} value={draft.goals ?? ''} onChangeText={(v) => update({ goals: v })} multiline error={errors.goals} />
                <Text style={[type.caption, { color: colors.muted }]}>{t('owner.budget')}</Text>
                <OptionChips options={feeOptions()} selected={draft.budgetBand ? [draft.budgetBand] : []} onChange={([v]) => update({ budgetBand: v })} />
                {errors.budgetBand ? <Text style={[type.caption, { color: colors.danger }]}>{errors.budgetBand}</Text> : null}
                <Text style={[type.caption, { color: colors.muted }]}>{t('owner.format')}</Text>
                <OptionChips options={formatOptions()} selected={draft.preferredFormat ? [draft.preferredFormat] : []} onChange={([v]) => update({ preferredFormat: v })} />
                {errors.preferredFormat ? <Text style={[type.caption, { color: colors.danger }]}>{errors.preferredFormat}</Text> : null}
              </>
            ) : null}

            {current.id === 'S1D' ? (
              <>
              <ReviewCard
                onEdit={(target) => { setReturnToReview(true); setStep(target); }}
                sections={[
                  { title: t('owner.stepBusiness'), step: 0, rows: [
                  { label: t('owner.businessName'), value: draft.businessName !== undefined ? String(draft.businessName) : '' },
                  { label: t('owner.industry'), value: draft.industry ? t(`industry.${draft.industry}`) : '' },
                  { label: t('owner.businessType'), value: draft.businessType ? t(`opt.businessType.${draft.businessType}`) : '' },
                  { label: t('owner.registrationType'), value: draft.registrationType ? t(`opt.registration.${draft.registrationType}`) : '' },
                  { label: t('owner.description'), value: draft.description !== undefined ? String(draft.description) : '' },
                  { label: t('owner.sector'), value: draft.sector ? t(`opt.sector.${draft.sector}`) : '' },
                  { label: t('owner.yearEstablished'), value: draft.yearEstablished !== undefined ? String(draft.yearEstablished) : '' },
                  { label: t('owner.website'), value: draft.website !== undefined ? String(draft.website) : '' },
                  { label: t('location.country'), value: draft.country !== undefined ? String(draft.country) : '' },
                  { label: t('location.state'), value: draft.state !== undefined ? String(draft.state) : '' },
                  { label: t('location.city'), value: draft.city !== undefined ? String(draft.city) : '' },
                  { label: t('owner.revenue'), value: draft.revenue ? t(`opt.revenue.${draft.revenue}`) : '' },
                  { label: t('owner.teamSize'), value: draft.teamSize ? t(`opt.teamSize.${draft.teamSize}`) : '' },
                  ] },
                  { title: t('owner.stepYou'), step: 1, rows: [
                  { label: t('owner.ownerName'), value: draft.ownerName !== undefined ? String(draft.ownerName) : '' },
                      { label: t('common.gender'), value: draft.gender ? t(`gender.${draft.gender}`) : '' },
                  { label: t('owner.designation'), value: draft.designation !== undefined ? String(draft.designation) : '' },
                  { label: t('owner.bio'), value: draft.ownerBio ?? '' },
                  { label: t('owner.yearsInBusiness'), value: draft.yearsInBusiness !== undefined ? String(draft.yearsInBusiness) : '' },
                  { label: t('common.phone'), value: draft.phone !== undefined ? String(draft.phone) : '' },
                  { label: t('common.linkedin'), value: draft.linkedin !== undefined ? String(draft.linkedin) : '' },
                  { label: t('common.qualificationOptional'), value: draft.qualification ? t(`opt.qualification.${draft.qualification}`) : '' },
                  ] },
                  { title: t('owner.stepNeeds'), step: 2, rows: [
                  { label: t('owner.needTitle'), value: draft.needTitle !== undefined ? String(draft.needTitle) : '' },
                  { label: t('owner.needTimeline'), value: draft.needTimeline ?? '' },
                  { label: t('owner.challenge'), value: draft.challenge !== undefined ? String(draft.challenge) : '' },
                  { label: t('owner.needExpertise'), value: (draft.needExpertise ?? []).map((id) => t(`expertise.${id}`)).join(', ') },
                  { label: t('owner.goals'), value: draft.goals !== undefined ? String(draft.goals) : '' },
                  { label: t('owner.budget'), value: draft.budgetBand ? t(`fee.${draft.budgetBand}`) : '' },
                  ...(draft.supportBudgets ?? []).map((entry) => ({ label: t('owner.areaBudget', { area: t(`expertise.${entry.expertise}`) }), value: t(`budget.${entry.budget}`) })),
                  { label: t('owner.format'), value: draft.preferredFormat ? t(`format.${draft.preferredFormat}`) : '' },
                  ] },
                ]}
              />
              {!initial ? <>
                <Text style={[type.caption, { color: colors.muted }]}>{t('consent.draftNotice')}</Text>
                <Checkbox label={t('consent.matchingTitle')} description={t('consent.matching')} checked={draft.consentChoices?.matching === true} onChange={(matching) => update({ consentChoices: { ...draft.consentChoices, matching } })} />
                <Checkbox label={t('consent.contactTitle')} description={t('consent.contact')} checked={draft.consentChoices?.contact_sharing === true} onChange={(contact_sharing) => update({ consentChoices: { ...draft.consentChoices, contact_sharing } })} />
                <Checkbox label={t('consent.notificationsTitle')} description={t('consent.notifications')} checked={draft.consentChoices?.notifications === true} onChange={(notifications) => update({ consentChoices: { ...draft.consentChoices, notifications } })} />
                <Checkbox label={t('consent.termsTitle')} description={t('consent.terms')} checked={draft.termsAccepted === true} onChange={(termsAccepted) => update({ termsAccepted })} />
                {errors.termsAccepted ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{errors.termsAccepted}</Text> : null}
              </> : null}
              </>
            ) : null}
          </View>
        </ScrollBody>

        {/* Footer: Back and Next side by side */}
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          {step > 0 ? (
            <View key="back" style={{ flex: 1 }}>
              <Button label={t('common.back')} variant="secondary" disabled={saving} onPress={() => setStep(step - 1)} />
            </View>
          ) : null}
          <View key="next" style={{ flex: step > 0 ? 2 : 1 }}>
            <Button label={isLast ? (initial ? t('common.save') : t('owner.submit')) : t('common.next')} onPress={isLast ? finish : next} disabled={saving} arrow={!isLast} />
          </View>
        </View>
        {saveError ? <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{t('onboarding.saveFailed')}</Text> : null}
      </View>
    </Screen>
  );
}
