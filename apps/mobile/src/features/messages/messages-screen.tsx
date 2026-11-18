import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';
import { api, type Conversation } from '@/lib/api';

function personFor(conversation: Conversation, role: 'owner' | 'professional') {
  return role === 'owner' ? conversation.request.professional : conversation.request.owner;
}

function when(iso: string) {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(undefined, sameDay ? { hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short' }).format(date);
}

export function MessagesScreen() {
  const { colors, radius, space, type } = useTheme();
  const { token, user } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFailed(false);
    try { setConversations((await api.getConversations(token)).conversations); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  useEffect(() => {
    const interval = setInterval(() => { void reload(); }, 10000);
    return () => clearInterval(interval);
  }, [reload]);

  const role = user?.role ?? 'owner';
  return (
    <TabScreen title={t('chat.title')} back>
      {failed ? <View style={{ gap: space.md }}><Text accessibilityRole="alert" style={[type.body, { color: colors.danger }]}>{t('chat.loadFailed')}</Text><Button label={t('common.retry')} onPress={() => void reload()} disabled={loading} /></View> : null}
      {conversations === null && loading ? <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} /> : null}
      {conversations && conversations.length === 0 && !failed ? <EmptyState icon="mail-outline" title={t('chat.emptyTitle')} body={t('chat.emptyBody')} /> : null}
      {conversations?.length ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          {conversations.map((item, index) => {
            const other = personFor(item, role);
            const name = role === 'owner' ? item.request.professional?.name ?? '' : item.request.owner?.businessName ?? '';
            const photo = other?.photoUrl ?? null;
            const last = item.latestMessage;
            const preview = last ? `${last.senderId === user?.id ? `${t('chat.you')}: ` : ''}${last.body}` : t('chat.noMessages');
            return (
              <Pressable
                key={item.request.id}
                accessibilityRole="button"
                accessibilityLabel={`${name}. ${preview}. ${item.unread ? t('chat.unreadCount', { count: item.unread }) : ''}`}
                onPress={() => router.push(`/messages/${item.request.id}` as Href)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 82, backgroundColor: item.unread ? colors.blueSoft : colors.surface, borderBottomWidth: index === conversations.length - 1 ? 0 : 1, borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 })}
              >
                <Avatar name={name} url={photo} size={48} icon={role === 'owner' ? 'person' : 'business'} />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                    <Text numberOfLines={1} style={[type.heading, { color: colors.text, flex: 1 }]}>{name}</Text>
                    {last ? <Text style={[type.footnote, { color: item.unread ? colors.primary : colors.muted }]}>{when(last.createdAt)}</Text> : null}
                  </View>
                  <Text numberOfLines={1} style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_500Medium' }]}>{item.request.need?.title ?? ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text numberOfLines={1} style={[type.body, { color: colors.muted, flex: 1, fontFamily: item.unread ? 'DMSans_600SemiBold' : 'DMSans_400Regular' }]}>{preview}</Text>
                    {item.unread > 0 ? <View style={{ minWidth: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.primary, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}><Text style={[type.footnote, { color: colors.primaryText }]}>{item.unread > 9 ? '9+' : item.unread}</Text></View> : null}
                    <Icon name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </TabScreen>
  );
}
