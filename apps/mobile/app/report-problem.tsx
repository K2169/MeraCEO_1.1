import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Screen } from '@/components/screen';
import { SelectField } from '@/components/select-field';
import { useTheme } from '@/components/use-theme';
import { newConsentIdempotencyKey } from '@/features/auth/consent-idempotency';
import { useSession } from '@/features/auth/session-provider';
import { api } from '@/lib/api';
import { t } from '@/i18n';

type Category = 'technical' | 'account' | 'privacy' | 'consultation' | 'other';
const categories: Category[] = ['technical', 'account', 'privacy', 'consultation', 'other'];

// Reports are private account submissions; a stable key prevents a retry creating duplicate reports.
export default function ReportProblemScreen() {
  const { colors, space, type } = useTheme();
  const { token } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string }>();
  const [category, setCategory] = useState<Category>();
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(params.requestId ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState<string | null>(null);
  const key = useRef(newConsentIdempotencyKey());
  const submitting = useRef(false);

  async function submit() {
    if (!token || submitting.current) return;
    const found: Record<string, string> = {};
    if (!category) found.category = t('common.requiredField');
    if (message.trim().length < 10) found.message = t('common.minLength', { min: 10 });
    setErrors(found);
    if (Object.keys(found).length || !category) return;
    submitting.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const report = await api.reportProblem(token, { category, message: message.trim(), ...(requestId.trim() ? { requestId: requestId.trim() } : {}), idempotencyKey: key.current });
      setReceived(report.id);
    } catch { setFailed(true); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <Screen back>
    <Text style={[type.title, { color: colors.text }]}>{t('report.title')}</Text>
    {!token ? <Button label={t('support.signInToReport')} onPress={() => router.replace('/sign-in' as Href)} /> : received ? <View style={{ gap: space.md }}>
      <Text accessibilityRole="alert" style={[type.body, { color: colors.text }]}>{t('report.received')}</Text>
      <Text selectable style={[type.caption, { color: colors.muted }]}>{t('report.reference', { id: received })}</Text>
      <Button label={t('support.title')} variant="secondary" onPress={() => router.replace('/support' as Href)} />
    </View> : <View style={{ gap: space.md }}>
      <SelectField label={t('report.category')} placeholder={t('common.select2')} options={categories.map((value) => ({ value, label: t(`report.category.${value}`) }))} value={category} onChange={(value) => { key.current = newConsentIdempotencyKey(); setCategory(value); }} error={errors.category} />
      <Input label={t('report.message')} value={message} onChangeText={(value) => { key.current = newConsentIdempotencyKey(); setMessage(value); }} multiline maxLength={500} helper={`${message.length}/500`} error={errors.message} editable={!busy} />
      <Input label={t('report.requestId')} value={requestId} onChangeText={(value) => { key.current = newConsentIdempotencyKey(); setRequestId(value); }} maxLength={100} editable={!busy} />
      <Text style={[type.caption, { color: colors.muted }]}>{t('report.privacyHint')}</Text>
      {failed ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{t('report.failed')}</Text> : null}
      <Button label={t('report.submit')} onPress={submit} disabled={busy} />
    </View>}
  </Screen>;
}
