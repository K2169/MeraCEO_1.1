import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from '@/components/button';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { api } from '@/lib/api';
import { t } from '@/i18n';

// Keep password values masked and excluded from autocorrection.
function PasswordField({ label, value, onChangeText, disabled }: { label: string; value: string; onChangeText: (value: string) => void; disabled: boolean }) {
  const { colors, radius, space, type } = useTheme();
  return <View style={{ gap: space.sm }}>
    <Text style={[type.caption, { color: colors.muted }]}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" autoComplete="new-password" editable={!disabled} style={[type.body, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 52 }]} />
  </View>;
}

// Password setup is available only inside an authenticated account.
export default function Security() {
  const { colors, space, type } = useTheme();
  const { user, token } = useSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The API binds the hash to its verified account email; the client sends no identity.
  async function save() {
    if (!token || busy) return;
    setSaved(false);
    if (password.length < 12 || password !== confirmation || new TextEncoder().encode(password).length > 128) {
      setMessage(t('security.invalid'));
      return;
    }
    setBusy(true); setMessage(null);
    try {
      await api.setPassword(token, password);
      setPassword(''); setConfirmation(''); setSaved(true);
    } catch { setMessage(t('security.failed')); }
    finally { setBusy(false); }
  }

  return <TabScreen title={t('security.title')} back>
    <View style={{ gap: space.md }}>
      <Text style={[type.body, { color: colors.muted }]}>{t('security.body')}</Text>
      {user?.email ? <Text style={[type.body, { color: colors.text }]}>{user.email}</Text> : null}
      <PasswordField disabled={busy} label={t('security.password')} value={password} onChangeText={(value) => { setPassword(value); setSaved(false); }} />
      <PasswordField disabled={busy} label={t('security.confirm')} value={confirmation} onChangeText={setConfirmation} />
      {message ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{message}</Text> : null}
      {saved ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.text }]}>{t('security.saved')}</Text> : null}
      <Button label={t('common.save')} disabled={busy || !token} onPress={save} />
    </View>
  </TabScreen>;
}
