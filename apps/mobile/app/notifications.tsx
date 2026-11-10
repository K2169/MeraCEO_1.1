import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/empty-state';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { setUnread } from '@/features/notifications/unread-store';
import { api, type AppNotification } from '@/lib/api';
import { t } from '@/i18n';

// How long ago something happened, in a few friendly words.
function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return t('time.now');
  if (minutes < 60) return t('time.minutes', { n: minutes });
  if (minutes < 1440) return t('time.hours', { n: Math.round(minutes / 60) });
  return t('time.days', { n: Math.round(minutes / 1440) });
}

const ICONS = {
  request_received: 'mail-unread-outline',
  request_accepted: 'checkmark-circle-outline',
  request_declined: 'close-circle-outline',
  request_cancelled: 'remove-circle-outline',
  consultation_scheduled: 'calendar-outline',
  consultation_completed: 'ribbon-outline',
} as const;

// The notification list. Opening it marks everything as read, but the dots stay for this visit so the
// person can see which ones were new.
export default function Notifications() {
  const { colors, radius, space, type } = useTheme();
  const { token } = useSession();
  const [items, setItems] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .getNotifications(token)
      .then(async (r) => {
        setItems(r.notifications);
        if (r.unread > 0) {
          await api.markNotificationsRead(token);
          setUnread(0);
        }
      })
      .catch(() => setItems([]));
  }, [token]);

  return (
    <TabScreen title={t('notif.title')} back>
      {items === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : items.length === 0 ? (
        <EmptyState icon="notifications-outline" title={t('notif.emptyTitle')} body={t('notif.emptyBody')} />
      ) : (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          {items.map((n, index) => {
            const unreadNow = n.readAt === null;
            const kind = n.type.replace('request_', '').replace('consultation_', '') as 'received' | 'accepted' | 'declined' | 'cancelled' | 'scheduled' | 'completed';
            return (
              <View
                key={n.id}
                style={{ flexDirection: 'row', gap: space.md, padding: space.lg, backgroundColor: unreadNow ? colors.blueSoft : colors.surface, borderBottomWidth: index === items.length - 1 ? 0 : 1, borderBottomColor: colors.border }}
              >
                <Icon name={ICONS[n.type]} size={20} color={n.type === 'request_declined' ? colors.danger : colors.primary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.body, { color: colors.text, fontFamily: unreadNow ? 'DMSans_700Bold' : 'DMSans_500Medium' }]}>{t(`notif.${kind}`, { actor: n.actorName })}</Text>
                  {n.needTitle ? <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_400Regular' }]}>{t('notif.about', { need: n.needTitle })}</Text> : null}
                  <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_500Medium' }]}>{ago(n.createdAt)}</Text>
                </View>
                {unreadNow ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 }} /> : null}
              </View>
            );
          })}
        </View>
      )}
    </TabScreen>
  );
}
