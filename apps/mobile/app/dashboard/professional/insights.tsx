import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FilterPills } from '@/components/filter-pills';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { BellButton } from '@/features/notifications/bell-button';
import { api, type Opportunity, type RequestItem } from '@/lib/api';
import { t } from '@/i18n';

type DateRange = '30d' | '90d' | 'all';
type InsightsData = { requests: RequestItem[]; opportunities: Opportunity[]; advisoryAreas: string[] };

function InsightMetric({ title, value, detail }: { title: string; value: string; detail?: string }) {
  const { colors, space, type } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 140, gap: space.xs, padding: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
      <Text style={[type.caption, { color: colors.muted }]}>{title}</Text>
      <Text style={[type.title, { color: colors.text }]}>{value}</Text>
      {detail ? <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_400Regular' }]}>{detail}</Text> : null}
    </View>
  );
}

// P7 Insights: use actual requests, scheduled consultations, open opportunities and profile areas.
// Earnings, profile views and match-rate tracking are called out as unavailable until supported by data.
export default function ProfessionalInsights() {
  const { colors, space, type } = useTheme();
  const { token } = useSession();
  const router = useRouter();
  const [range, setRange] = useState<DateRange>('30d');
  const [data, setData] = useState<InsightsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!token) return;
    setFailed(false);
    try {
      const [requestResult, opportunityResult, profileResult] = await Promise.all([
        api.getRequests(token),
        api.getOpportunities(token),
        api.getProfile(token),
      ]);
      const profile = profileResult.data;
      const expertise = Array.isArray(profile.expertise) ? profile.expertise.filter((value): value is string => typeof value === 'string').map((id) => t(`expertise.${id}`)) : [];
      const industries = Array.isArray(profile.industriesAdvised) ? profile.industriesAdvised.filter((value): value is string => typeof value === 'string').map((id) => t(`industry.${id}`)) : [];
      setData({ requests: requestResult.requests, opportunities: opportunityResult.opportunities, advisoryAreas: [...new Set([...expertise, ...industries])] });
      setNow(Date.now());
    } catch {
      setFailed(true);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const duration = range === '30d' ? 30 : range === '90d' ? 90 : null;
  const cutoff = duration === null ? null : now - duration * 24 * 60 * 60 * 1000;
  const requests = (data?.requests ?? []).filter((item) => cutoff === null || Date.parse(item.createdAt) >= cutoff);
  const consultations = requests.filter((item) =>
    (item.status === 'accepted' || item.status === 'completed')
    && !!item.scheduledAt
    && (cutoff === null || Date.parse(item.scheduledAt) >= cutoff),
  );

  return (
    <TabScreen title={t('insights.title')} back actions={<BellButton />}>
      <View style={{ gap: space.sm }}>
        <Text style={[type.body, { color: colors.text }]}>{t('insights.subtitle')}</Text>
        <FilterPills
          pills={[
            { value: '30d', label: t('insights.range30Days') },
            { value: '90d', label: t('insights.range90Days') },
            { value: 'all', label: t('insights.rangeAll') },
          ]}
          selected={range}
          onSelect={(value) => { if (value) setRange(value); }}
        />
        <Text style={[type.caption, { color: colors.muted }]}>{t('insights.rangeNote')}</Text>
      </View>

      {failed ? (
        <View style={{ gap: space.sm }}>
          <Text accessibilityRole="alert" style={[type.body, { color: colors.danger }]}>{t('common.genericError')}</Text>
          <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : data === null ? <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} /> : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <InsightMetric title={t('insights.consultations')} value={String(consultations.length)} detail={consultations.length ? t('insights.consultationsDetail') : t('insights.noConsultations')} />
            <InsightMetric title={t('insights.requests')} value={String(requests.length)} detail={requests.length ? t('insights.requestsDetail') : t('insights.noRequests')} />
            <InsightMetric title={t('insights.opportunities')} value={String(data.opportunities.length)} detail={t('insights.openOpportunities')} />
          </View>

          <View style={{ gap: space.sm }}>
            <Text style={[type.heading, { color: colors.text }]}>{t('insights.advisoryAreas')}</Text>
            {data.advisoryAreas.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {data.advisoryAreas.map((area) => <View key={area} style={{ paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 999, backgroundColor: colors.blueSoft }}><Text style={[type.caption, { color: colors.primary }]}>{area}</Text></View>)}
              </View>
            ) : <Text style={[type.body, { color: colors.muted }]}>{t('insights.noAdvisoryAreas')}</Text>}
          </View>

          <View style={{ gap: space.sm }}>
            <Text style={[type.heading, { color: colors.text }]}>{t('insights.moreMetrics')}</Text>
            <Card>
              <Text style={[type.body, { color: colors.text }]}>{t('insights.earnings')}</Text>
              <Text style={[type.caption, { color: colors.muted }]}>{t('insights.earningsUnavailable')}</Text>
            </Card>
            <Card>
              <Text style={[type.body, { color: colors.text }]}>{t('insights.profileViews')}</Text>
              <Text style={[type.caption, { color: colors.muted }]}>{t('insights.notTracked')}</Text>
            </Card>
            <Card>
              <Text style={[type.body, { color: colors.text }]}>{t('insights.matchRate')}</Text>
              <Text style={[type.caption, { color: colors.muted }]}>{t('insights.notTracked')}</Text>
            </Card>
          </View>
          <Button variant="secondary" label={t('dashboard.findOpportunities')} onPress={() => router.push('/dashboard/professional/opportunities' as Href)} />
        </>
      )}
    </TabScreen>
  );
}
