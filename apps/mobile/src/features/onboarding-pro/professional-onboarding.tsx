import { GENDER_OPTIONS, professionalOnboardingSchema, professionalRegistrationSchema, type ProfessionalOnboarding } from '@meraceo/shared';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { DateOfBirthPicker } from '@/components/date-of-birth-picker';
import { Input } from '@/components/input';
import { LocationFields } from '@/components/location-fields';
import { OptionChips } from '@/components/option-chips';
import { Screen } from '@/components/screen';
import { ScrollBody } from '@/components/scroll-body';
import { SelectField } from '@/components/select-field';
import { OnboardingStepper } from '@/components/onboarding-stepper';
import { useTheme } from '@/components/use-theme';
import { toIsoDate } from '@/features/auth/date-of-birth';
import { clearDateOfBirthDraft, getDateOfBirthDraft, saveDateOfBirthDraft } from '@/features/auth/date-of-birth-draft';
import { consentChoiceSignature, newConsentIdempotencyKey } from '@/features/auth/consent-idempotency';
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
  revenueOptions,
  teamSizeOptions,
  timezoneOptions,
  durationOptions,
} from '@/features/onboarding/options';
import { PhotoField } from '@/features/onboarding/photo-field';
import { ReviewCard, type ReviewSection } from '@/features/onboarding/review-card';
import { SkillsField } from '@/features/onboarding/skills-field';
import { cleanDraft, errorsFor, placeLine, toNumber } from '@/features/onboarding/wizard-utils';
import { api, ApiError } from '@/lib/api';
import { t } from '@/i18n';

// The review step needs ticks, so the draft holds booleans (the schema demands true at submit). photoKey and
// photoUri belong to the optional profile photo: where it is stored, and a local preview.
type Draft = Partial<Omit<ProfessionalOnboarding, 'disclaimerAccepted' | 'termsAccepted'>> & {
  disclaimerAccepted?: boolean;
  termsAccepted?: boolean;
  photoKey?: string;
  photoUri?: string;
  consentChoices?: { matching?: boolean; contact_sharing?: boolean; notifications?: boolean };
  consentIdempotencyKey?: string;
  consentIdempotencyChoiceSignature?: string;
};

type EmploymentEntry = NonNullable<ProfessionalOnboarding['employmentHistory']>[number];
type EducationEntry = NonNullable<ProfessionalOnboarding['educationHistory']>[number];
type CertificationEntry = NonNullable<ProfessionalOnboarding['certifications']>[number];
type AvailabilityWindow = NonNullable<ProfessionalOnboarding['availabilityWindows']>[number];
function newEntryId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

function TextActionButton({ label, onPress, destructive = false }: { label: string; onPress: () => void; destructive?: boolean }) {
  const { colors, space, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        justifyContent: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: space.sm,
        opacity: pressed ? 0.68 : 1,
      })}
    >
      <Text style={[type.caption, { color: destructive ? colors.danger : colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

// Each step: its title, its one-line hint, and the fields that must be valid before moving on.
const STEPS = [
  { id: 'P1A', title: 'pro.stepPersonal', stage: 'pro.stagePersonal', hint: 'onboarding.hint.proYou', fields: ['name', 'discreetMode', 'displayName', 'gender', 'country', 'state', 'city', 'phone', 'linkedin'] },
  { id: 'P1B', title: 'pro.stepExperience2', stage: 'pro.stageProfessional', hint: 'onboarding.hint.proExp', fields: ['qualification', 'headline', 'designation', 'company', 'yearsExperience', 'employmentType', 'industry', 'experience', 'workHistory', 'employmentHistory', 'educationHistory', 'certifications', 'skills'] },
  { id: 'P1C', title: 'pro.stepAvailability', stage: 'pro.stageExpertise', hint: 'onboarding.hint.proAvail', fields: ['expertise', 'industriesAdvised', 'preferredTeamSizes', 'preferredRevenueBands', 'feeBand', 'formats', 'durationMinutes', 'engagementType', 'days', 'availabilityWindows', 'timezone', 'timeSlots'] },
  { id: 'P1D', title: 'pro.stepReview', stage: 'pro.stageReview', hint: 'onboarding.hint.pro4', fields: ['disclaimerAccepted', 'termsAccepted'] },
] as const;

// Professional onboarding (W3-02 UI, W3-03 validation). Every step fits one screen and scrolls only if it must.
// The draft stays on the device while filling in; the finished form is saved to the server (W3-05).
// With `initial` it edits an already saved profile: it starts from those answers and does not touch the on-device draft.
export function ProfessionalOnboardingFlow({ onComplete, initial }: { onComplete: () => void; initial?: Draft }) {
  const { colors, radius, space, type } = useTheme();
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
    let active = true;
    setLoadFailed(false);
    if (initial) {
      const initialDays = initial.availabilityWindows?.length
        ? [...new Set(initial.availabilityWindows.map((window) => window.day))]
        : initial.days;
      setDraft({ ...initial, days: initialDays, durationMinutes: initial.durationMinutes ?? 60, timezone: initial.timezone ?? deviceTimezone() });
      setLoaded(true);
      return;
    }
    Promise.all([
      progress.getDraft<Draft>('professional', user?.id),
      user?.id ? getDateOfBirthDraft(user.id) : Promise.resolve(null),
    ]).then(([saved, savedDob]) => {
      if (!active) return;
      const next = { ...(saved ?? {}) };
      if (next.availabilityWindows?.length) {
        next.days = [...new Set(next.availabilityWindows.map((window) => window.day))];
      }
      next.timezone ??= deviceTimezone();
      if (!next.name?.trim() && user?.name?.trim()) next.name = user.name.trim();
      const ageCheckIsComplete = user?.ageConfirmed === true && user.dateOfBirthSet === true;
      if (!ageCheckIsComplete && savedDob) setDateOfBirth(savedDob);
      if (ageCheckIsComplete && savedDob && user?.id) void clearDateOfBirthDraft(user.id).catch(() => undefined);
      setDraft(next);
      if (!saved?.name?.trim() && next.name && user?.id) void progress.setDraft('professional', next, user.id).catch(() => undefined);
      setLoaded(true);
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAttempt]);

  // Merge a change into the draft and save it on the device straight away.
  function update(patch: Draft) {
    const next = { ...draft, ...patch };
    if ('consentChoices' in patch && consentChoiceSignature(next.consentChoices) !== consentChoiceSignature(draft.consentChoices)) {
      // Consent is append-only: a changed choice set is a new submission, so it needs a new key.
      delete next.consentIdempotencyKey;
      delete next.consentIdempotencyChoiceSignature;
    }
    setDraft(next);
    if (!initial && user?.id) void progress.setDraft('professional', next, user.id);
  }

  function setEmployment(index: number, patch: Partial<EmploymentEntry>) {
    update({ employmentHistory: (draft.employmentHistory ?? []).map((entry, i) => i === index ? { ...entry, ...patch } : entry) });
  }

  function setEducation(index: number, patch: Partial<EducationEntry>) {
    update({ educationHistory: (draft.educationHistory ?? []).map((entry, i) => i === index ? { ...entry, ...patch } : entry) });
  }

  function setCertification(index: number, patch: Partial<CertificationEntry>) {
    update({ certifications: (draft.certifications ?? []).map((entry, i) => i === index ? { ...entry, ...patch } : entry) });
  }

  function setAvailabilityWindows(windows: AvailabilityWindow[]) {
    update({ availabilityWindows: windows, days: [...new Set(windows.map((window) => window.day))] });
  }

  function pathError(path: string) {
    const issue = issuesNow().find((item) => item.path.map(String).join('.') === path);
    return issue ? t(issue.code === 'too_small' ? 'common.requiredField' : 'common.invalid') : undefined;
  }

  // Validation problems for the current draft. Optional boxes left empty count as "not given".
  function issuesNow() {
    return professionalOnboardingSchema.safeParse(cleanDraft(draft)).error?.issues ?? [];
  }

  // Check the current step, then move on if it is valid.
  async function next() {
    if (saving) return;
    const found = errorsFor(issuesNow(), STEPS[step]!.fields);
    if (step === 0 && !initial && !draft.gender) found.gender = t('common.requiredField');
    if (step === 0 && !initial && draft.discreetMode === undefined) found.discreetMode = t('common.requiredField');
    if (step === 0 && !initial && !draft.displayName?.trim()) found.displayName = t('common.requiredField');
    if (STEPS[step]?.id === 'P1C' && !initial) {
      if (!draft.durationMinutes) found.durationMinutes = t('common.requiredField');
      if (!draft.availabilityWindows?.length) found.availabilityWindows = t('common.requiredField');
      if (!draft.timezone) found.timezone = t('common.requiredField');
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (step === 0 && !initial && !(user?.ageConfirmed === true && user.dateOfBirthSet === true)) {
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
            await api.setRole(token, 'professional');
          } catch (err) {
            if (!(err instanceof ApiError && err.status === 409)) throw err;
          }
        }
        const account = await api.getMe(token);
        await refresh();
        setDateOfBirth('');
        if (account.role !== 'professional') {
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
    if (returnToReview) {
      setFurthestUnlocked((furthest) => Math.max(furthest, step + 1));
      setReturnToReview(false);
      setStep(STEPS.length - 1);
      return;
    }
    setFurthestUnlocked((furthest) => Math.max(furthest, step + 1));
    setStep(step + 1);
  }

  function selectStep(target: number) {
    const maxUnlocked = initial ? STEPS.length - 1 : furthestUnlocked;
    if (saving || target > maxUnlocked) return;
    if (step === STEPS.length - 1 && target < step) setReturnToReview(true);
    setStep(target);
  }

  // Check the whole form, jump back to the first problem, or save it to the server and finish.
  async function finish() {
    if (saving) return;
    const schema = initial ? professionalOnboardingSchema : professionalRegistrationSchema;
    const result = schema.safeParse(cleanDraft(draft));
    if (!result.success) {
      const all = errorsFor(result.error.issues, STEPS.flatMap((s) => s.fields));
      setErrors(all);
      setReturnToReview(true);
      setStep(Math.max(0, STEPS.findIndex((s) => s.fields.some((f) => all[f]))));
      return;
    }
    if (!token || !user?.id) return;
    setSaving(true);
    setSaveError(false);
    try {
      const choices = draft.consentChoices ?? {};
      const choiceSignature = consentChoiceSignature(choices);
      const savedChoiceSignature = draft.consentIdempotencyChoiceSignature ?? consentChoiceSignature(draft.consentChoices);
      const canReuseConsentKey = savedChoiceSignature === choiceSignature;
      const consentIdempotencyKey = !initial
        ? (canReuseConsentKey && draft.consentIdempotencyKey ? draft.consentIdempotencyKey : newConsentIdempotencyKey())
        : undefined;
      if (!initial) {
        const withKey = { ...draft, consentIdempotencyKey, consentIdempotencyChoiceSignature: choiceSignature };
        setDraft(withKey);
        if (user?.id) await progress.setDraft('professional', withKey, user.id);
      }
      await api.saveProfile(token, result.data);
      // The photo was uploaded earlier in this flow. Saving it on the profile is a nice-to-have, so a failure here is ignored.
      if (!initial && draft.photoKey) await api.savePhoto(token, draft.photoKey).catch(() => undefined);
      if (!initial) {
        await api.recordConsents(token, [
          { type: 'matching', granted: choices.matching === true },
          { type: 'contact_sharing', granted: choices.contact_sharing === true },
          { type: 'notifications', granted: choices.notifications === true },
          { type: 'terms', granted: true },
        ], consentIdempotencyKey!);
      }
      if (!initial && user?.id) await progress.clearDraft('professional', user.id);
      if (user?.id) await clearDateOfBirthDraft(user.id);
      await refresh();
      onComplete();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return (
    <Screen scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        {loadFailed ? <>
          <Text accessibilityRole="alert" style={[type.body, { color: colors.danger }]}>{t('common.genericError')}</Text>
          <Button label={t('common.retry')} onPress={() => { setLoadFailed(false); setLoadAttempt((attempt) => attempt + 1); }} />
        </> : <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />}
      </View>
    </Screen>
  );
  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  const discreetModeOptions = [
    { value: 'yes', label: t('pro.yes') },
    { value: 'no', label: t('pro.no') },
  ];
  const selectedDiscreetMode: ('yes' | 'no')[] = draft.discreetMode === undefined ? [] : [draft.discreetMode ? 'yes' : 'no'];
  // A small helper for the pick-from-a-list fields.
  const pick = <T extends string>(label: string, options: { value: T; label: string }[], value: T | undefined, key: keyof Draft, searchable = false) => (
    <SelectField label={label} placeholder={t('common.select2')} options={options} value={value} searchable={searchable} onChange={(v) => update({ [key]: v } as Draft)} error={errors[key as string]} />
  );
  const zones = timezoneOptions();
  const timezoneChoices = draft.timezone && !zones.some((option) => option.value === draft.timezone)
    ? [{ value: draft.timezone, label: draft.timezone }, ...zones]
    : zones;
  const fieldError = (key: string) => errors[key]
    ? <Text style={[type.caption, { color: colors.danger }]}>{errors[key]}</Text>
    : null;

  return (
    <Screen scroll={false} decor={!initial}>
      <View style={{ flex: 1, gap: space.md }}>
        {/* Header: tappable P1A-P1D navigation, title and one-line hint */}
        <View style={{ gap: space.md }}>
          <OnboardingStepper
            steps={STEPS}
            current={step}
            furthestUnlocked={initial ? STEPS.length - 1 : furthestUnlocked}
            onSelect={selectStep}
            disabled={saving}
          />
          <View style={{ gap: space.xs, marginTop: space.sm }}>
            <Text style={[type.title, { color: colors.text }]}>{t(current.title)}</Text>
            <Text style={[type.body, { color: colors.muted }]}>{t(current.hint)}</Text>
          </View>
        </View>

        {/* Body: the fields for this step. It scrolls when a step has more fields than fit, while the buttons below stay pinned. */}
        <ScrollBody key={current.id}>
          <View style={{ gap: space.md }}>
            {current.id === 'P1A' ? (
              <>
                {/* Editing happens from the Profile tab, which has its own photo button */}
                {!initial ? <PhotoField kind="photo" name={draft.name ?? ''} uri={draft.photoUri} onPicked={(photoKey, photoUri) => update({ photoKey, photoUri })} /> : null}
                <Input label={t('pro.name')} value={draft.name ?? ''} onChangeText={(v) => update({ name: v })} error={errors.name} />
                <View style={{ gap: space.xs }}>
                  <Text style={[type.heading, { color: colors.text }]}>{t('pro.discreetMode')}</Text>
                  <Text style={[type.caption, { color: colors.muted }]}>{t('pro.discreetModeHelp')}</Text>
                  <OptionChips
                    options={discreetModeOptions}
                    selected={selectedDiscreetMode}
                    onChange={(values) => { const value = values[0]; if (value) update({ discreetMode: value === 'yes' }); }}
                  />
                  {errors.discreetMode ? <Text style={[type.caption, { color: colors.danger }]}>{errors.discreetMode}</Text> : null}
                </View>
                <Input label={t('pro.displayName')} value={draft.displayName ?? ''} onChangeText={(v) => update({ displayName: v })} error={errors.displayName} />
                <SelectField label={t('common.gender')} placeholder={t('common.select2')} options={GENDER_OPTIONS.map((value) => ({ value, label: t(`gender.${value}`) }))} value={draft.gender} onChange={(gender) => update({ gender })} error={errors.gender} />
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
                {user?.email ? <Input label={t('auth.accountEmail')} value={user.email} onChangeText={() => undefined} helper={t('auth.googleEmailPrivate')} editable={false} /> : null}
                <Input label={t('common.phone')} value={draft.phone ?? ''} onChangeText={(v) => update({ phone: v })} keyboardType="phone-pad" error={errors.phone} />
                <LocationFields value={draft} onChange={update} errors={errors} />
                <Input label={t('common.linkedin')} value={draft.linkedin ?? ''} onChangeText={(v) => update({ linkedin: v })} keyboardType="url" autoCapitalize="none" error={errors.linkedin} />
              </>
            ) : null}

            {current.id === 'P1B' ? (
              <>
                <Input label={t('pro.headline')} placeholder={t('pro.headlineExample')} value={draft.headline ?? ''} onChangeText={(v) => update({ headline: v })} error={errors.headline} />
                <Input label={t('pro.designation')} value={draft.designation ?? ''} onChangeText={(v) => update({ designation: v })} error={errors.designation} />
                <Input label={t('pro.company')} value={draft.company ?? ''} onChangeText={(v) => update({ company: v })} error={errors.company} />
                <Input label={t('pro.yearsExperience')} value={draft.yearsExperience?.toString() ?? ''} onChangeText={(v) => update({ yearsExperience: toNumber(v) })} keyboardType="numeric" error={errors.yearsExperience} />
                {pick(t('pro.employmentType'), employmentOptions(), draft.employmentType, 'employmentType')}
                {pick(t('pro.industry'), industryOptions(), draft.industry, 'industry', true)}
                <SkillsField value={draft.skills ?? []} onChange={(skills) => update({ skills })} error={errors.skills} />

                <Text style={[type.heading, { color: colors.text, marginTop: space.sm }]}>{t('pro.employmentHistory')}</Text>
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.employmentHistoryHelp')}</Text>
                <Input label={t('pro.legacyWorkHistory')} value={draft.workHistory ?? ''} onChangeText={(v) => update({ workHistory: v })} multiline error={errors.workHistory} />
                {(draft.employmentHistory ?? []).map((entry, index) => (
                  <View key={entry.id} style={{ gap: space.md, padding: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
                    <Input label={t('pro.historyRole')} value={entry.title} onChangeText={(v) => setEmployment(index, { title: v })} error={pathError(`employmentHistory.${index}.title`)} />
                    <Input label={t('pro.historyOrganization')} value={entry.organization} onChangeText={(v) => setEmployment(index, { organization: v })} error={pathError(`employmentHistory.${index}.organization`)} />
                    <Input label={t('pro.startMonth')} placeholder="YYYY-MM" value={entry.startDate} onChangeText={(v) => setEmployment(index, { startDate: v })} error={pathError(`employmentHistory.${index}.startDate`)} />
                    {!entry.current ? <Input label={t('pro.endMonth')} placeholder="YYYY-MM" value={entry.endDate ?? ''} onChangeText={(v) => setEmployment(index, { endDate: v })} error={pathError(`employmentHistory.${index}.endDate`)} /> : null}
                    <Checkbox label={t('pro.currentRole')} checked={entry.current} onChange={(currentRole) => setEmployment(index, { current: currentRole, endDate: currentRole ? undefined : entry.endDate })} />
                    <TextActionButton label={t('pro.removeEntry')} destructive onPress={() => update({ employmentHistory: (draft.employmentHistory ?? []).filter((_, i) => i !== index) })} />
                  </View>
                ))}
                {errors.employmentHistory ? <Text style={[type.caption, { color: colors.danger }]}>{errors.employmentHistory}</Text> : null}
                <TextActionButton label={t('pro.addEmployment')} onPress={() => update({ employmentHistory: [...(draft.employmentHistory ?? []), { id: newEntryId(), title: '', organization: '', startDate: '', current: false }] })} />

                <Input label={t('pro.experience')} helper={t('pro.experienceHelp')} value={draft.experience ?? ''} onChangeText={(v) => update({ experience: v })} multiline error={errors.experience} />

                <Text style={[type.heading, { color: colors.text, marginTop: space.sm }]}>{t('pro.educationHistory')}</Text>
                {pick(t('common.qualification'), qualificationOptions(), draft.qualification, 'qualification', true)}
                {(draft.educationHistory ?? []).map((entry, index) => (
                  <View key={entry.id} style={{ gap: space.md, padding: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
                    <SelectField label={t('common.qualification')} placeholder={t('common.select2')} options={qualificationOptions()} value={entry.qualification} searchable onChange={(v) => setEducation(index, { qualification: v })} />
                    <Input label={t('pro.institution')} value={entry.institution} onChangeText={(v) => setEducation(index, { institution: v })} error={pathError(`educationHistory.${index}.institution`)} />
                    <Input label={t('pro.fieldOfStudy')} value={entry.fieldOfStudy ?? ''} onChangeText={(v) => setEducation(index, { fieldOfStudy: v })} error={pathError(`educationHistory.${index}.fieldOfStudy`)} />
                    <Input label={t('pro.completionYear')} value={entry.completionYear ?? ''} onChangeText={(v) => setEducation(index, { completionYear: v.replace(/\D/g, '').slice(0, 4) })} keyboardType="numeric" error={pathError(`educationHistory.${index}.completionYear`)} />
                    <TextActionButton label={t('pro.removeEntry')} destructive onPress={() => update({ educationHistory: (draft.educationHistory ?? []).filter((_, i) => i !== index) })} />
                  </View>
                ))}
                {errors.educationHistory ? <Text style={[type.caption, { color: colors.danger }]}>{errors.educationHistory}</Text> : null}
                <TextActionButton label={t('pro.addEducation')} onPress={() => update({ educationHistory: [...(draft.educationHistory ?? []), { id: newEntryId(), qualification: 'other', institution: '' }] })} />

                <Text style={[type.heading, { color: colors.text, marginTop: space.sm }]}>{t('pro.certifications')}</Text>
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.certificationVerification')}</Text>
                {(draft.certifications ?? []).map((entry, index) => (
                  <View key={entry.id} style={{ gap: space.md, padding: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
                    <Input label={t('pro.certificationName')} value={entry.name} onChangeText={(v) => setCertification(index, { name: v })} error={pathError(`certifications.${index}.name`)} />
                    <Input label={t('pro.certificationIssuer')} value={entry.issuer} onChangeText={(v) => setCertification(index, { issuer: v })} error={pathError(`certifications.${index}.issuer`)} />
                    <Input label={t('pro.issueYearOptional')} value={entry.issueYear ?? ''} onChangeText={(v) => setCertification(index, { issueYear: v.replace(/\D/g, '').slice(0, 4) })} keyboardType="numeric" error={pathError(`certifications.${index}.issueYear`)} />
                    <TextActionButton label={t('pro.removeEntry')} destructive onPress={() => update({ certifications: (draft.certifications ?? []).filter((_, i) => i !== index) })} />
                  </View>
                ))}
                {errors.certifications ? <Text style={[type.caption, { color: colors.danger }]}>{errors.certifications}</Text> : null}
                <TextActionButton label={t('pro.addCertification')} onPress={() => update({ certifications: [...(draft.certifications ?? []), { id: newEntryId(), name: '', issuer: '' }] })} />
              </>
            ) : null}

            {current.id === 'P1C' ? (
              <>
                <Text style={[type.heading, { color: colors.text }]}>{t('pro.expertise')}</Text>
                <OptionChips multi maxSelected={5} options={expertiseOptions()} selected={draft.expertise ?? []} onChange={(v) => update({ expertise: v })} />
                {fieldError('expertise')}
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.industriesAdvised')}</Text>
                <OptionChips multi maxSelected={5} options={industryOptions()} selected={draft.industriesAdvised ?? []} onChange={(v) => update({ industriesAdvised: v })} />
                {fieldError('industriesAdvised')}

                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.sm }} />
                <Text style={[type.heading, { color: colors.text }]}>{t('pro.formats')}</Text>
                <OptionChips multi options={formatOptions()} selected={draft.formats ?? []} onChange={(v) => update({ formats: v })} />
                {fieldError('formats')}
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.feeBand')}</Text>
                <OptionChips options={feeOptions()} selected={draft.feeBand ? [draft.feeBand] : []} onChange={([v]) => update({ feeBand: v })} />
                {fieldError('feeBand')}
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.duration')}</Text>
                <OptionChips options={durationOptions()} selected={draft.durationMinutes ? [String(draft.durationMinutes)] : []} onChange={([v]) => update({ durationMinutes: Number(v) as 30 | 60 | 90 })} />
                {fieldError('durationMinutes')}
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.engagementType')}</Text>
                <OptionChips options={engagementOptions()} selected={draft.engagementType ? [draft.engagementType] : []} onChange={([v]) => update({ engagementType: v })} />
                {fieldError('engagementType')}

                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.sm }} />
                <Text style={[type.heading, { color: colors.text }]}>{t('pro.weeklyAvailability')}</Text>
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.availabilityHelp')}</Text>
                {fieldError('days')}
                <SelectField label={t('pro.timezone')} placeholder={t('common.select2')} options={timezoneChoices} value={draft.timezone} onChange={(v) => update({ timezone: v })} error={errors.timezone} />
                {(draft.availabilityWindows ?? []).map((window, index) => (
                  <View key={window.id} style={{ gap: space.md, padding: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
                    <SelectField label={t('pro.availableDay')} placeholder={t('common.select2')} options={dayOptions()} value={window.day} onChange={(day) => setAvailabilityWindows((draft.availabilityWindows ?? []).map((item, i) => i === index ? { ...item, day } : item))} error={pathError(`availabilityWindows.${index}.day`)} />
                    <Input label={t('pro.startTime')} placeholder="09:00" value={window.startTime} onChangeText={(startTime) => setAvailabilityWindows((draft.availabilityWindows ?? []).map((item, i) => i === index ? { ...item, startTime } : item))} error={pathError(`availabilityWindows.${index}.startTime`)} />
                    <Input label={t('pro.endTime')} placeholder="17:00" value={window.endTime} onChangeText={(endTime) => setAvailabilityWindows((draft.availabilityWindows ?? []).map((item, i) => i === index ? { ...item, endTime } : item))} error={pathError(`availabilityWindows.${index}.endTime`)} />
                    <TextActionButton label={t('pro.removeEntry')} destructive onPress={() => setAvailabilityWindows((draft.availabilityWindows ?? []).filter((_, i) => i !== index))} />
                  </View>
                ))}
                {errors.availabilityWindows ? <Text style={[type.caption, { color: colors.danger }]}>{errors.availabilityWindows}</Text> : null}
                <TextActionButton label={t('pro.addAvailability')} onPress={() => setAvailabilityWindows([...(draft.availabilityWindows ?? []), { id: newEntryId(), day: 'mon', startTime: '', endTime: '' }])} />

                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.sm }} />
                <Text style={[type.heading, { color: colors.text, marginTop: space.sm }]}>{t('pro.preferredBusinessProfile')}</Text>
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.preferredBusinessSize')}</Text>
                <OptionChips multi options={teamSizeOptions()} selected={draft.preferredTeamSizes ?? []} onChange={(v) => update({ preferredTeamSizes: v })} />
                {fieldError('preferredTeamSizes')}
                <Text style={[type.caption, { color: colors.muted }]}>{t('pro.preferredBusinessStage')}</Text>
                <OptionChips multi options={revenueOptions()} selected={draft.preferredRevenueBands ?? []} onChange={(v) => update({ preferredRevenueBands: v })} />
                {fieldError('preferredRevenueBands')}
                <Input label={t('pro.legacyTimeSlots')} helper={t('pro.legacyTimeSlotsHelp')} value={draft.timeSlots ?? ''} onChangeText={(v) => update({ timeSlots: v })} error={errors.timeSlots} />
              </>
            ) : null}

            {current.id === 'P1D' ? (
              <>
                <ReviewCard
                  hideEmptyRows
                  onEdit={(target) => { setReturnToReview(true); setStep(target); }}
                  sections={[
                    { title: t('pro.stepPersonal'), step: 0, rows: [
                      { label: t('pro.name'), value: draft.name ?? '' },
                      { label: t('pro.discreetMode'), value: draft.discreetMode === undefined ? '' : t(draft.discreetMode ? 'pro.yes' : 'pro.no') },
                      { label: t('pro.displayName'), value: draft.displayName ?? '' },
                      { label: t('common.gender'), value: draft.gender ? t(`gender.${draft.gender}`) : '' },
                      { label: t('auth.accountEmail'), value: user?.email ?? '' },
                      { label: t('common.phone'), value: draft.phone ?? '' },
                      { label: t('location.place'), value: placeLine(draft) },
                      { label: t('common.linkedin'), value: draft.linkedin ?? '' },
                      { label: t('age.dateLabel'), value: user?.dateOfBirthSet ? t('pro.ageCheckComplete') : '' },
                    ] },
                    { title: t('pro.stepExperience2'), step: 1, rows: [
                      { label: t('pro.headline'), value: draft.headline ?? '' },
                      { label: t('pro.designation'), value: draft.designation ?? '' },
                      { label: t('pro.company'), value: draft.company ?? '' },
                      { label: t('pro.yearsExperience'), value: draft.yearsExperience !== undefined ? String(draft.yearsExperience) : '' },
                      { label: t('pro.employmentType'), value: draft.employmentType ? t(`opt.employment.${draft.employmentType}`) : '' },
                      { label: t('pro.industry'), value: draft.industry ? t(`industry.${draft.industry}`) : '' },
                      { label: t('pro.experience'), value: draft.experience ?? '' },
                      { label: t('pro.skills'), value: (draft.skills ?? []).join(', ') },
                      { label: t('common.qualification'), value: draft.qualification ? t(`opt.qualification.${draft.qualification}`) : '' },
                      { label: t('pro.employmentHistory'), value: (draft.employmentHistory ?? []).map((entry) => `${entry.title} · ${entry.organization} · ${entry.startDate}–${entry.current ? t('pro.currentRole') : entry.endDate ?? ''}`).join('\n') },
                      { label: t('pro.educationHistory'), value: (draft.educationHistory ?? []).map((entry) => `${t(`opt.qualification.${entry.qualification}`)} · ${entry.institution}${entry.fieldOfStudy ? ` · ${entry.fieldOfStudy}` : ''}${entry.completionYear ? ` · ${entry.completionYear}` : ''}`).join('\n') },
                      { label: t('pro.certifications'), value: (draft.certifications ?? []).map((entry) => `${entry.name} · ${entry.issuer}${entry.issueYear ? ` · ${entry.issueYear}` : ''}`).join('\n') },
                      { label: t('pro.legacyWorkHistory'), value: draft.workHistory ?? '' },
                    ] },
                    { title: t('pro.stepAvailability'), step: 2, rows: [
                      { label: t('pro.expertise'), value: (draft.expertise ?? []).map((id) => t(`expertise.${id}`)).join(', ') },
                      { label: t('pro.industriesAdvised'), value: (draft.industriesAdvised ?? []).map((id) => t(`industry.${id}`)).join(', ') },
                      { label: t('pro.feeBand'), value: draft.feeBand ? t(`fee.${draft.feeBand}`) : '' },
                      { label: t('pro.formats'), value: (draft.formats ?? []).map((id) => t(`format.${id}`)).join(', ') },
                      { label: t('pro.duration'), value: draft.durationMinutes ? t('pro.durationMinutes', { minutes: draft.durationMinutes }) : '' },
                      { label: t('pro.engagementType'), value: draft.engagementType ? t(`opt.engagement.${draft.engagementType}`) : '' },
                      { label: t('pro.weeklyAvailability'), value: (draft.availabilityWindows ?? []).map((window) => `${t(`opt.day.${window.day}`)} ${window.startTime}–${window.endTime}`).join('\n') || (draft.days ?? []).map((d) => t(`opt.day.${d}`)).join(', ') },
                      { label: t('pro.timezone'), value: draft.timezone ?? '' },
                      { label: t('pro.preferredBusinessSize'), value: (draft.preferredTeamSizes ?? []).map((id) => t(`opt.teamSize.${id}`)).join(', ') },
                      { label: t('pro.preferredBusinessStage'), value: (draft.preferredRevenueBands ?? []).map((id) => t(`opt.revenue.${id}`)).join(', ') },
                    ] },
                  ] satisfies ReviewSection[]}
                />
                <Text style={[type.heading, { color: colors.text }]}>{t('pro.consentPreferences')}</Text>
                <Checkbox label={t('consent.matchingTitle')} description={t('consent.matching')} checked={draft.consentChoices?.matching === true} onChange={(matching) => update({ consentChoices: { ...draft.consentChoices, matching } })} />
                <Checkbox label={t('consent.contactTitle')} description={t('consent.contact')} checked={draft.consentChoices?.contact_sharing === true} onChange={(contact_sharing) => update({ consentChoices: { ...draft.consentChoices, contact_sharing } })} />
                <Checkbox label={t('consent.notificationsTitle')} description={t('consent.notifications')} checked={draft.consentChoices?.notifications === true} onChange={(notifications) => update({ consentChoices: { ...draft.consentChoices, notifications } })} />
                <Checkbox label={t('pro.disclaimer')} checked={draft.disclaimerAccepted === true} onChange={(v) => update({ disclaimerAccepted: v })} />
                <Checkbox label={t('pro.terms')} checked={draft.termsAccepted === true} onChange={(v) => update({ termsAccepted: v })} />
              </>
            ) : null}
          </View>
        </ScrollBody>

        {/* Footer: Back and Next side by side */}
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          {step > 0 ? (
            <View key="back" style={{ flex: 1 }}>
              <Button label={t('common.back')} variant="secondary" onPress={() => setStep(step - 1)} />
            </View>
          ) : null}
          <View key="next" style={{ flex: step > 0 ? 2 : 1 }}>
          <Button label={isLast ? (initial ? t('common.save') : t('pro.submit')) : t('common.next')} onPress={isLast ? finish : next} disabled={saving} arrow={!isLast} />
          </View>
        </View>
        {saveError ? <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{t('onboarding.saveFailed')}</Text> : null}
      </View>
    </Screen>
  );
}
