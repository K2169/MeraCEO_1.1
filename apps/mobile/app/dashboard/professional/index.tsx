import { professionalOnboardingSchema } from '@meraceo/shared';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { DashboardSummary } from '@/features/dashboard/dashboard-summary';
import { BellButton } from '@/features/notifications/bell-button';
import { api } from '@/lib/api';
import { t } from '@/i18n';

// Professional home: real request activity, profile readiness, and review status.
export default function ProfessionalDashboard() {
  const { colors, space, type } = useTheme();
  const { token, user } = useSession();
  const router = useRouter();
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [profileFailed, setProfileFailed] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!token) return;
    setProfileFailed(false);
    try {
      const result = await api.getProfile(token);
      setProfileReady(professionalOnboardingSchema.safeParse(result.data).success);
    } catch {
      setProfileFailed(true);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void loadProfile(); }, [loadProfile]));

  return (
    <TabScreen title={t('dashboard.homeProfessional')} actions={
      <>
        <Pressable accessibilityRole="button" accessibilityLabel={t('insights.title')} onPress={() => router.push('/dashboard/professional/insights' as Href)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Icon name="trending-up" size={18} color={colors.primary} />
          <Text style={[type.caption, { color: colors.primary }]}>{t('insights.title')}</Text>
        </Pressable>
        <BellButton />
      </>
    }>
      {profileFailed ? (
        <Button variant="secondary" label={t('common.retry')} onPress={() => void loadProfile()} />
      ) : profileReady === false ? (
        <Card tint="blue">
          <Text style={[type.heading, { color: colors.text }]}>{t('profile.incomplete')}</Text>
          <Button label={t('account.editProfile')} onPress={() => router.push('/account/edit' as Href)} />
        </Card>
      ) : profileReady === true ? (
        <Card>
          <Text style={[type.body, { color: colors.text }]}>{t('profile.ready')}</Text>
        </Card>
      ) : null}

      {user?.moderation === 'pending_review' ? (
        <Card tint="green">
          <Text style={[type.heading, { color: colors.text }]}>{t('pro.pendingTitle')}</Text>
          <Text style={[type.body, { color: colors.muted }]}>{t('pro.pendingBody')}</Text>
        </Card>
      ) : null}

      <DashboardSummary role="professional" />
    </TabScreen>
  );
}
