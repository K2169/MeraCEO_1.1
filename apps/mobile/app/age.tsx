import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { IconBubble } from '@/components/icon-bubble';
import { Input } from '@/components/input';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';
import { api } from '@/lib/api';

// Collects date of birth for age verification and routes minors to the block screen.
export default function AgeCheck() {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { token, refresh } = useSession();
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [invalidDate, setInvalidDate] = useState(false);

  // Formats numeric input as day/month/year while the user types.
  function formatDateInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    return digits.replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2}\/\d{2})(\d)/, '$1/$2');
  }

  // Converts a valid day/month/year value to the ISO date expected by the API.
  function toIsoDate(value: string): string | null {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
    const [day, month, year] = value.split('/').map(Number);
    if (year! < 1900) return null;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const parsed = new Date(`${iso}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso || iso > new Date().toISOString().slice(0, 10)) return null;
    return iso;
  }

  // Save the date, reload the user, then go to the eligible or blocked screen.
  async function submitDateOfBirth() {
    if (!token) return;
    const isoDate = toIsoDate(dateOfBirth);
    if (!isoDate) {
      setInvalidDate(true);
      return;
    }
    setBusy(true);
    setFailed(false);
    setInvalidDate(false);
    try {
      const user = await api.setAge(token, isoDate);
      await refresh();
      router.replace((user.ageConfirmed ? '/' : '/age-blocked') as Href);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false} decor>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
        <IconBubble icon="shield-checkmark-outline" size={130} />
        <Text style={[type.title, { color: colors.text, textAlign: 'center' }]}>{t('age.title')}</Text>
        <Text style={[type.body, { color: colors.muted, textAlign: 'center' }]}>{t('age.body')}</Text>
      </View>
      <View style={{ gap: space.md }}>
        <Input
          label={t('age.dateLabel')}
          value={dateOfBirth}
          onChangeText={(value) => { setDateOfBirth(formatDateInput(value)); setInvalidDate(false); }}
          placeholder={t('age.datePlaceholder')}
          error={invalidDate ? t('age.invalidDate') : undefined}
          keyboardType="number-pad"
          maxLength={10}
        />
        <Button label={t('age.continue')} onPress={submitDateOfBirth} disabled={busy} />
        {failed ? <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{t('common.genericError')}</Text> : null}
      </View>
    </Screen>
  );
}
