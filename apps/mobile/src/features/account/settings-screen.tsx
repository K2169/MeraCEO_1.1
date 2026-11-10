import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { TabScreen } from '@/components/tab-screen';
import { SettingsGroup, SettingsRow } from '@/components/settings-list';
import { useTheme } from '@/components/use-theme';
import { progress } from '@/features/auth/progress-store';
import { useSession } from '@/features/auth/session-provider';
import { api, type ConsentChoices } from '@/lib/api';
import { t } from '@/i18n';

type OptionalChoice = 'matching' | 'contact_sharing' | 'notifications';

// Settings: privacy choices, your data (download, delete) and sign out. It is its own page, opened from the
// gear in the top right of the Account / Profile tab, so these controls are not one tap away from the tab bar.
export function SettingsScreen() {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { token, signOut } = useSession();
  const [choices, setChoices] = useState<ConsentChoices | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load the current privacy choices.
  useEffect(() => {
    if (!token) return;
    api.getConsents(token).then((r) => setChoices(r.choices)).catch(() => undefined);
  }, [token]);

  // Save one changed choice. The switch moves straight away and moves back if saving fails.
  async function toggle(choice: OptionalChoice, granted: boolean) {
    if (!token || !choices) return;
    const before = choices;
    setChoices({ ...choices, [choice]: granted });
    setMessage(null);
    try {
      await api.recordConsents(token, [{ type: choice, granted }]);
    } catch {
      setChoices(before);
      setMessage(t('account.consentFailed'));
    }
  }

  // Fetch everything we hold about the person and open the phone's share sheet so they can save it.
  async function download() {
    if (!token) return;
    setMessage(null);
    try {
      const data = await api.exportData(token);
      await Share.share({ title: 'MeraCEO data', message: JSON.stringify(data, null, 2) });
    } catch {
      setMessage(t('account.exportFailed'));
    }
  }

  // Leave: forget the session on this phone and go to the welcome screen.
  async function leave() {
    await progress.clearAll();
    await signOut();
    router.replace('/get-started' as Href);
  }

  // Delete the account on the server, then leave.
  async function deleteAccount() {
    if (!token) return;
    setBusy(true);
    try {
      await api.deleteAccount(token);
      setConfirmDelete(false);
      await leave();
    } catch {
      setMessage(t('account.deleteFailed'));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }


  const rows: { key: OptionalChoice; icon: 'sparkles-outline' | 'call-outline' | 'notifications-outline'; title: string; body: string }[] = [
    { key: 'matching', icon: 'sparkles-outline', title: t('consent.matchingTitle'), body: t('consent.matching') },
    { key: 'contact_sharing', icon: 'call-outline', title: t('consent.contactTitle'), body: t('consent.contact') },
    { key: 'notifications', icon: 'notifications-outline', title: t('consent.notificationsTitle'), body: t('consent.notifications') },
  ];

  return (
    <TabScreen title={t('settings.title')} back>
      <SettingsGroup title={t('account.group.privacy')} footer={t('account.privacyNote2')}>
        {choices
          ? rows.map((row, index) => (
              <SettingsRow
                key={row.key}
                icon={row.icon}
                label={row.title}
                description={row.body}
                switchValue={choices[row.key] === true}
                onSwitch={(value) => toggle(row.key, value)}
                last={index === rows.length - 1}
              />
            ))
          : null}
      </SettingsGroup>

      <SettingsGroup title={t('account.group.data')}>
        <SettingsRow icon="download-outline" label={t('account.export')} onPress={download} />
        <SettingsRow icon="trash-outline" label={t('account.delete')} danger onPress={() => setConfirmDelete(true)} last />
      </SettingsGroup>

      {message ? <Text style={[type.caption, { color: colors.danger }]}>{message}</Text> : null}

      <Button label={t('common.signOut')} variant="ghost" onPress={leave} />

      <BottomSheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('account.deleteTitle')}>
        <View style={{ gap: space.lg, paddingBottom: space.md }}>
          <Text style={[type.body, { color: colors.muted }]}>{t('account.deleteBody')}</Text>
          <Button label={t('account.deleteConfirm')} variant="danger" disabled={busy} onPress={deleteAccount} />
          <Button label={t('common.cancel')} variant="secondary" onPress={() => setConfirmDelete(false)} />
        </View>
      </BottomSheet>
    </TabScreen>
  );
}
