import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { DashboardSummary } from '@/features/dashboard/dashboard-summary';
import { BellButton } from '@/features/notifications/bell-button';
import { useSession } from '@/features/auth/session-provider';
import { api } from '@/lib/api';
import { t } from '@/i18n';

// Owner dashboard: show real activity counts and direct paths to the next useful actions.
export default function OwnerDashboard() {
  const { colors, space, type } = useTheme();
  const { token } = useSession();
  const [openNeeds, setOpenNeeds] = useState<number | undefined>();
  const [needsFailed, setNeedsFailed] = useState(false);

  // Load the owner's active needs for the dashboard count.
  const loadNeeds = useCallback(async () => {
    if (!token) return;
    setNeedsFailed(false);
    try {
      const result = await api.getNeeds(token);
      setOpenNeeds(result.needs.filter((need) => need.status === 'open').length);
    } catch {
      setNeedsFailed(true);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void loadNeeds(); }, [loadNeeds]));

  return (
    <TabScreen title={t('dashboard.homeOwner')} actions={<BellButton />}>
      {needsFailed ? (
        <View style={{ gap: space.sm }}>
          <Text accessibilityRole="alert" style={[type.body, { color: colors.danger }]}>{t('common.genericError')}</Text>
          <Button variant="secondary" label={t('common.retry')} onPress={() => void loadNeeds()} />
        </View>
      ) : null}
      <DashboardSummary role="owner" openNeeds={openNeeds} />
    </TabScreen>
  );
}
