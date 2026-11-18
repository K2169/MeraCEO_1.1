import { professionalOnboardingSchema, type ProfessionalOnboarding } from '@meraceo/shared';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { OptionChips } from '@/components/option-chips';
import { SelectField } from '@/components/select-field';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { dayOptions, durationOptions, formatOptions, timezoneOptions } from '@/features/onboarding/options';
import { api } from '@/lib/api';
import { t } from '@/i18n';

type Window = NonNullable<ProfessionalOnboarding['availabilityWindows']>[number];

// P4 edits recurring rules only; existing consultation snapshots stay unchanged.
export default function Availability() {
  const { colors, radius, space, type } = useTheme();
  const { token, user } = useSession();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [windows, setWindows] = useState<Window[]>([]);
  const [formats, setFormats] = useState<ProfessionalOnboarding['formats']>([]);
  const [duration, setDuration] = useState<30 | 60 | 90>(60);
  const [zone, setZone] = useState('Asia/Kolkata');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  // Load only the authenticated professional's own profile, with recoverable failure.
  const load = useCallback(async () => {
    if (!token || user?.role !== 'professional') return;
    setFailed(false);
    try {
      const response = await api.getProfile(token);
      if (response.role !== 'professional') throw new Error('Wrong role');
      const data = response.data as Partial<ProfessionalOnboarding>;
      setProfile(response.data);
      setWindows(data.availabilityWindows ?? []);
      setFormats(data.formats ?? []);
      setDuration(data.durationMinutes ?? 60);
      setZone(data.timezone ?? 'Asia/Kolkata');
    } catch { setFailed(true); }
  }, [token, user?.role]);
  useEffect(() => { void load(); }, [load]);

  // Preserve other profile fields while validating the complete updated profile.
  async function save() {
    if (!token || !profile || busy || user?.role !== 'professional') return;
    const result = professionalOnboardingSchema.safeParse({ ...profile, formats, durationMinutes: duration, timezone: zone, availabilityWindows: windows, days: [...new Set(windows.map((window) => window.day))] });
    setSaved(false);
    if (!result.success) {
      const labels: Record<string, string> = { formats: t('pro.formats'), durationMinutes: t('pro.duration'), timezone: t('pro.timezone'), availabilityWindows: t('pro.weeklyAvailability'), days: t('pro.weeklyAvailability') };
      setErrors([...new Set(result.error.issues.map((issue) => `${labels[String(issue.path[0])] ?? t('account.editProfile')}: ${t('common.invalid')}`))]);
      return;
    }
    setBusy(true); setErrors([]);
    try { await api.saveProfile(token, result.data); setProfile(result.data); setSaved(true); }
    catch { setErrors([t('onboarding.saveFailed')]); }
    finally { setBusy(false); }
  }

  // Change one weekly window without mutating the saved profile.
  function change(index: number, patch: Partial<Window>) {
    setSaved(false);
    setWindows((current) => current.map((window, i) => i === index ? { ...window, ...patch } : window));
  }
  const zones = timezoneOptions();
  if (!zones.some((option) => option.value === zone)) zones.unshift({ value: zone, label: zone });

  return <TabScreen title={t('pro.weeklyAvailability')} back>
    {user?.role !== 'professional' ? <Text style={[type.body, { color: colors.text }]}>{t('common.invalid')}</Text> : failed ? <View style={{ gap: space.md }}>
      <Text accessibilityRole="alert" style={[type.body, { color: colors.danger }]}>{t('common.genericError')}</Text>
      <Button label={t('common.retry')} variant="secondary" onPress={() => void load()} />
    </View> : !profile ? <ActivityIndicator color={colors.primary} /> : <View style={{ gap: space.md }}>
      <Text style={[type.body, { color: colors.muted }]}>{t('pro.availabilityHelp')}</Text>
      <Text style={[type.heading, { color: colors.text }]}>{t('pro.formats')}</Text>
      <OptionChips multi options={formatOptions()} selected={formats} onChange={setFormats} />
      <Text style={[type.caption, { color: colors.muted }]}>{t('pro.duration')}</Text>
      <OptionChips options={durationOptions()} selected={[String(duration)]} onChange={([value]) => { setSaved(false); setDuration(Number(value) as 30 | 60 | 90); }} />
      <SelectField label={t('pro.timezone')} placeholder={t('common.select2')} options={zones} value={zone} onChange={(value) => { setSaved(false); setZone(value); }} />
      {windows.map((window, index) => <View key={window.id} style={{ gap: space.md, padding: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }}>
        <SelectField label={t('pro.availableDay')} placeholder={t('common.select2')} options={dayOptions()} value={window.day} onChange={(day) => change(index, { day })} />
        <Input label={t('pro.startTime')} placeholder="09:00" value={window.startTime} onChangeText={(startTime) => change(index, { startTime })} />
        <Input label={t('pro.endTime')} placeholder="17:00" value={window.endTime} onChangeText={(endTime) => change(index, { endTime })} />
        <Button label={t('pro.removeEntry')} variant="ghost" onPress={() => { setSaved(false); setWindows((current) => current.filter((_, i) => i !== index)); }} disabled={busy} />
      </View>)}
      <Button label={t('pro.addAvailability')} variant="secondary" disabled={busy || windows.length >= 28} onPress={() => { setSaved(false); setWindows((current) => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, day: 'mon', startTime: '', endTime: '' }]); }} />
      {errors.map((error) => <Text key={error} accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{error}</Text>)}
      {saved ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.text }]}>{t('edit.saved')}</Text> : null}
      <Button label={t('common.save')} onPress={save} disabled={busy} />
    </View>}
  </TabScreen>;
}
