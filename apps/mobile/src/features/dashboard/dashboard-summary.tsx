import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { api, type RequestItem } from '@/lib/api';
import { t } from '@/i18n';

// Role dashboards use actual participant records, never illustrative activity metrics.
export function DashboardSummary({ role, openNeeds }: { role: 'owner' | 'professional'; openNeeds?: number }) {
  const { colors, radius, space, type } = useTheme();
  const { token } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<RequestItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const loadRequests = useCallback(async () => {
    if (!token) return;
    setFailed(false);
    try {
      const result = await api.getRequests(token);
      setRequests(result.requests);
      setNow(Date.now());
    } catch {
      setFailed(true);
    }
  }, [token]);
  useFocusEffect(useCallback(() => { void loadRequests(); }, [loadRequests]));
  const base = `/dashboard/${role}`;
  const pending = requests?.filter((item) => item.status === 'pending').length;
  const upcoming = requests?.filter((item) => item.status === 'accepted' && item.scheduledAt && Date.parse(item.scheduledAt) > now).sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  const metrics = [
    ...(role === 'owner' && openNeeds !== undefined ? [{ label: t('dashboard.openNeeds'), count: openNeeds, href: `${base}/requests` }] : []),
    { label: t('dashboard.pendingRequests'), count: pending, href: `${base}/requests` },
    { label: t('dashboard.upcomingConsultations'), count: upcoming?.length, href: `${base}/consultations` },
  ];
  return <View style={{ gap: space.md }}>
    {failed ? <Button variant="secondary" label={t('common.retry')} onPress={() => void loadRequests()} /> : requests === null ? <ActivityIndicator color={colors.primary} /> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {metrics.map((metric) => <Pressable key={metric.href + metric.label} accessibilityRole="button" accessibilityLabel={`${metric.label}: ${metric.count ?? 0}`} onPress={() => router.push(metric.href as Href)} style={({ pressed }) => ({ flex: 1, minWidth: 90, minHeight: 84, padding: space.md, gap: space.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.7 : 1 })}>
          <Text style={[type.heading, { color: colors.primary }]}>{metric.count}</Text>
          <Text style={[type.caption, { color: colors.text }]}>{metric.label}</Text>
        </Pressable>)}
      </View>
      {upcoming && upcoming.length > 0 ? <View style={{ gap: space.sm }}>
        <Text style={[type.heading, { color: colors.text }]}>{t('dashboard.upcomingConsultations')}</Text>
        {upcoming.slice(0, 2).map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push(`${base}/consultations` as Href)} style={{ padding: space.md, gap: space.xs, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
          <Text style={[type.body, { color: colors.text }]}>{item.need?.title ?? t('consultations.title')}</Text>
          <Text style={[type.caption, { color: colors.muted }]}>{new Date(item.scheduledAt!).toLocaleString(undefined, { timeZone: item.consultation?.timezone ?? undefined })}</Text>
        </Pressable>)}
      </View> : null}
    </>}
    <View style={{ gap: space.sm }}>
      {role === 'owner' ? <Button label={t('owner.postNeed')} onPress={() => router.push('/needs/new' as Href)} /> : <Button label={t('dashboard.setAvailability')} onPress={() => router.push('/availability' as Href)} />}
      <Button label={t(role === 'owner' ? 'dashboard.findExperts' : 'dashboard.findOpportunities')} variant="secondary" onPress={() => router.push(`${base}/${role === 'owner' ? 'discover' : 'opportunities'}` as Href)} />
    </View>
  </View>;
}
