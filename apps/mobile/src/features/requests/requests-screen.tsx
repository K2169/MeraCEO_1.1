import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';

import { EmptyState } from '@/components/empty-state';
import { TabScreen } from '@/components/tab-screen';
import { BellButton } from '@/features/notifications/bell-button';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { NeedCard } from '@/features/needs/need-card';
import { api, type Need } from '@/lib/api';
import { t } from '@/i18n';

import { RequestCard } from './request-card';
import { useRequests } from './use-requests';

// Which requests a tab shows. "Requests" is everything still being decided or closed without a meeting;
// "Consultations" is what was accepted (or completed).
export type RequestSection = 'requests' | 'consultations';

// The Requests and Consultations tabs, used by both roles. Owners see what they sent; professionals see
// what they received and can accept or decline.
export function RequestsScreen({ viewer, section }: { viewer: 'owner' | 'professional'; section: RequestSection }) {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { token } = useSession();
  const { requests, busyId, error, act, schedule } = useRequests();
  // Owners manage their needs here too (PRD section 07, "Manage requests": needs, request status, replies).
  const [needs, setNeeds] = useState<Need[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (token && viewer === 'owner') api.getNeeds(token).then((r) => setNeeds(r.needs)).catch(() => undefined);
    }, [token, viewer]),
  );
  const showNeeds = viewer === 'owner' && section === 'requests';
  const consultations = section === 'consultations';
  const inSection = (requests ?? []).filter((r) => (r.status === 'accepted' || r.status === 'completed') === consultations);
  // Consultations: upcoming ones first (soonest, then those without a time), completed ones last.
  const shown = consultations
    ? [...inSection].sort((a, b) => {
        if ((a.status === 'completed') !== (b.status === 'completed')) return a.status === 'completed' ? 1 : -1;
        return (a.scheduledAt ?? '9').localeCompare(b.scheduledAt ?? '9');
      })
    : inSection;

  return (
    <TabScreen title={consultations ? t('consultations.title') : t('requests.title')} actions={<BellButton />}>
      {showNeeds ? (
        <View style={{ gap: space.md }}>
          {/* Section header: the title on the left, a small action on the right */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[type.heading, { color: colors.text }]}>{t('owner.needs')}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/needs/new' as Href)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Icon name="add" size={18} color={colors.primary} />
              <Text style={[type.caption, { color: colors.primary, fontSize: 14 }]}>{t('owner.postNeed')}</Text>
            </Pressable>
          </View>
          {needs.map((need) => (
            <NeedCard key={need.id} need={need} onPress={() => router.push(`/needs/${need.id}` as Href)} />
          ))}
          <Text style={[type.heading, { color: colors.text, marginTop: space.sm }]}>{t('owner.requestsTitle')}</Text>
        </View>
      ) : null}
      {requests && shown.length > 0 ? (
        <View style={{ gap: space.md }}>
          {shown.map((item) => (
            <RequestCard key={item.id} item={item} viewer={viewer} busy={busyId === item.id} onAction={(action) => act(item.id, action)} onSchedule={(iso) => schedule(item.id, iso)} />
          ))}
          {error ? <Text style={[type.caption, { color: colors.danger }]}>{t('request.actionFailed')}</Text> : null}
        </View>
      ) : requests ? (
        consultations ? (
          <EmptyState icon="calendar-outline" title={t('consultations.emptyTitle')} body={t('consultations.emptyBody')} />
        ) : viewer === 'owner' ? (
          <EmptyState title={t('pro.noRequestsTitle')} body={t('requests.ownerEmpty')} />
        ) : (
          <EmptyState title={t('pro.noRequestsTitle')} body={t('pro.noRequestsBody')} />
        )
      ) : null}
    </TabScreen>
  );
}
