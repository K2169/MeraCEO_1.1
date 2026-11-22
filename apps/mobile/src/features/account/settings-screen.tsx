import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Share, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { SelectField } from '@/components/select-field';
import { TabScreen } from '@/components/tab-screen';
import { SettingsGroup, SettingsRow } from '@/components/settings-list';
import { useTheme } from '@/components/use-theme';
import { progress } from '@/features/auth/progress-store';
import { signOutOfGoogle } from '@/features/auth/google-sign-in';
import { useSession } from '@/features/auth/session-provider';
import { api, type ConsentChoices } from '@/lib/api';
import { t } from '@/i18n';
import { initializePreferences, savePreferences, usePreferences } from '@/features/settings/preferences';

type OptionalChoice = 'matching' | 'contact_sharing' | 'notifications';

// Settings: privacy choices, your data (download, delete) and sign out. It is its own page, opened from the
// gear in the top right of the Account / Profile tab, so these controls are not one tap away from the tab bar.
export function SettingsScreen() {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { token, signOut, user, refresh } = useSession();
  const [choices, setChoices] = useState<ConsentChoices | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalComplete, setApprovalComplete] = useState(false);
  const preferences = usePreferences();
  const [info, setInfo] = useState<'help' | 'about' | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Keep local presentation choices across app launches.
  useEffect(() => { void initializePreferences(); }, []);

  // Publish a preference only after durable storage succeeds.
  async function changePreference(patch: Parameters<typeof savePreferences>[0]) {
    try {
      await savePreferences(patch);
      setMessage(null);
    } catch { setMessage(t('settings.preferenceFailed')); }
  }

  // Recover a failed privacy-choice load without treating it as an empty account.
  const loadChoices = useCallback(async () => {
    if (!token) return;
    setLoadFailed(false);
    try { setChoices((await api.getConsents(token)).choices); }
    catch { setLoadFailed(true); }
  }, [token]);

  // Load the current privacy choices.
  useEffect(() => {
    if (!token) return;
    void loadChoices();
  }, [token, loadChoices]);

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

  // Testing shortcut: approve this signed-in professional so owners can find the profile.
  async function approveOwnProfile() {
    if (!token || user?.role !== 'professional') return;
    setApprovalBusy(true);
    setApprovalComplete(false);
    setMessage(null);
    try {
      await api.approveOwnProfessionalProfile(token);
      await refresh();
      setApprovalComplete(true);
    } catch {
      setMessage(t('settings.selfApproveFailed'));
    } finally {
      setApprovalBusy(false);
    }
  }

  // Leave: forget the session on this phone and go to the welcome screen.
  async function leave() {
    await progress.clearAll();
    try { await signOutOfGoogle(); } catch { /* The app session must still be cleared if Google is offline. */ }
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
      <View style={{ gap: space.md }}>
        <SelectField label={t('settings.theme')} placeholder={t('common.select')} value={preferences.theme}
          options={(['system', 'light', 'dark'] as const).map((value) => ({ value, label: t(`settings.theme.${value}`) }))}
          onChange={(theme) => void changePreference({ theme })} />
        <SelectField label={t('settings.language')} placeholder={t('common.select')} value={preferences.language}
          options={[{ value: 'en', label: t('settings.language.en') }, { value: 'hi', label: t('settings.language.hi') }]}
          onChange={(language) => void changePreference({ language })} />
      </View>
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
          : loadFailed ? (
            <View style={{ padding: space.lg, gap: space.md }}>
              <Text accessibilityRole="alert" style={[type.body, { color: colors.danger }]}>{t('settings.loadFailed')}</Text>
              <Button label={t('common.retry')} onPress={() => void loadChoices()} />
            </View>
          ) : <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} style={{ padding: space.lg }} />}
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow icon="lock-closed-outline" label={t('security.title')} onPress={() => router.push('/security' as Href)} last />
      </SettingsGroup>

      {user?.role === 'professional' && user.profileComplete ? (
        <SettingsGroup title={t('settings.testing')} footer={t('settings.selfApproveDescription')}>
          <View style={{ padding: space.lg, gap: space.sm }}>
            <Button
              variant="secondary"
              label={t('settings.selfApprove')}
              disabled={approvalBusy}
              onPress={() => void approveOwnProfile()}
            />
            {user.moderation === 'approved' ? <Text style={[type.caption, { color: colors.muted }]}>{t('settings.selfApproveAlready')}</Text> : null}
            {approvalComplete ? <Text style={[type.caption, { color: colors.accentText }]}>{t('settings.selfApproveSuccess')}</Text> : null}
          </View>
        </SettingsGroup>
      ) : null}

      <SettingsGroup title={t('account.group.data')}>
        <SettingsRow icon="download-outline" label={t('account.export')} onPress={download} />
        <SettingsRow icon="trash-outline" label={t('account.delete')} danger onPress={() => setConfirmDelete(true)} last />
      </SettingsGroup>

      {message ? <Text style={[type.caption, { color: colors.danger }]}>{message}</Text> : null}

      <SettingsGroup title={t('settings.helpGroup')}>
        <SettingsRow icon="information-circle-outline" label={t('settings.help')} onPress={() => router.push('/support' as Href)} />
        <SettingsRow icon="information-circle-outline" label={t('settings.about')} onPress={() => setInfo('about')} last />
      </SettingsGroup>
      <BottomSheet visible={info !== null} onClose={() => setInfo(null)} title={t(`settings.${info ?? 'help'}`)}>
        <View style={{ gap: space.md, paddingBottom: space.md }}>
          <Text style={[type.body, { color: colors.text }]}>{t(info === 'about' ? 'settings.aboutBody' : 'settings.helpBody')}</Text>
        </View>
      </BottomSheet>

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
