import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';
import { hasContactInformation } from '@meraceo/shared';

import { useToast } from '@/components/toast';
import { api, ApiError, type ChatMessage, type RequestItem } from '@/lib/api';

function clock(iso: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function MessageThreadScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { colors, radius, space, type } = useTheme();
  const { token, user } = useSession();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const scroll = useRef<{ scrollToEnd?: (options?: { animated?: boolean }) => void } | null>(null);
  const [request, setRequest] = useState<RequestItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [contactBlocked, setContactBlocked] = useState(false);

  const reload = useCallback(async () => {
    if (!token || !requestId) return;
    setFailed(false);
    try {
      const thread = await api.getMessages(token, requestId);
      setRequest(thread.request);
      setMessages(thread.messages);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [requestId, token]);
  useEffect(() => { void reload(); }, [reload]);
  // Keep the open thread current when the other participant sends from another session.
  useEffect(() => {
    const interval = setInterval(() => { void reload(); }, 5000);
    return () => clearInterval(interval);
  }, [reload]);

  const role = user?.role ?? 'owner';
  const otherName = role === 'owner' ? request?.professional?.name ?? '' : request?.owner?.businessName ?? '';
  const otherPhoto = role === 'owner' ? request?.professional?.photoUrl : request?.owner?.photoUrl;
  const submit = async () => {
    const body = draft.trim();
    if (!token || !requestId || !body || sending) return;
    setContactBlocked(hasContactInformation(body));
    if (hasContactInformation(body)) return;
    Keyboard.dismiss();
    setSending(true);
    setSendFailed(false);
    try {
      const sent = await api.sendMessage(token, requestId, body);
      setMessages((current) => [...(current ?? []), sent]);
      setDraft('');
      requestAnimationFrame(() => scroll.current?.scrollToEnd?.({ animated: true }));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'contact_info_not_allowed') setContactBlocked(true);
      else setSendFailed(true);
    }
    finally { setSending(false); }
  };

  const footer = request && !failed ? (
    <View style={{ gap: space.xs, paddingBottom: Math.max(insets.bottom, space.sm) }}>
      {sendFailed ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{t('chat.sendFailed')}</Text> : null}
      {contactBlocked ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{t('chat.contactInfoBlocked')}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
        <TextInput
          accessibilityLabel={t('chat.messageLabel')}
          value={draft}
          onChangeText={(value) => { setDraft(value); if (!hasContactInformation(value)) setContactBlocked(false); }}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={colors.muted}
          editable={!sending}
          multiline
          maxLength={2000}
          returnKeyType="default"
          style={{ flex: 1, maxHeight: 120, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm, color: colors.text, backgroundColor: colors.background, fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 20, textAlignVertical: 'center' }}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={t('chat.send')} accessibilityState={{ disabled: !draft.trim() || sending }} disabled={!draft.trim() || sending} onPress={() => void submit()} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: !draft.trim() || sending ? colors.disabledFace : colors.primary, opacity: pressed ? 0.75 : 1 })}>
          {sending ? <ActivityIndicator color={colors.primaryText} size="small" /> : <Icon name="paper-plane-outline" size={20} color={draft.trim() ? colors.primaryText : colors.disabledText} />}
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <TabScreen
      title={otherName || t('chat.conversation')}
      back
      actions={(
        <Pressable accessibilityRole="button" accessibilityLabel={t('chat.videoSoon')} onPress={() => showToast(t('chat.videoSoon'), 'info')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="videocam-outline" size={23} color={colors.muted} />
        </Pressable>
      )}
      footer={footer}
      scrollRef={(instance) => { scroll.current = instance as typeof scroll.current; }}
      onContentSizeChange={() => scroll.current?.scrollToEnd?.({ animated: true })}
    >
      {request ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <Avatar name={otherName} url={otherPhoto ?? null} size={44} icon={role === 'owner' ? 'person' : 'business'} />
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: colors.text }]}>{otherName}</Text>
            <Text numberOfLines={2} style={[type.caption, { color: colors.muted }]}>{request.need?.title ?? ''}</Text>
          </View>
        </View>
      ) : null}
      {failed ? <View style={{ gap: space.md }}><Text accessibilityRole="alert" style={[type.body, { color: colors.danger }]}>{t('chat.threadFailed')}</Text><Button label={t('common.retry')} onPress={() => { setLoading(true); void reload(); }} disabled={loading} /></View> : null}
      {loading && messages === null ? <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} /> : null}
      {messages?.length === 0 && !loading && !failed ? <View style={{ flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: space.xs }}><Icon name="mail-outline" size={28} color={colors.muted} /><Text style={[type.body, { color: colors.muted, textAlign: 'center' }]}>{t('chat.noMessages')}</Text></View> : null}
      {messages?.length ? (
        <View style={{ gap: space.sm, paddingBottom: space.md }}>
          {messages.map((message) => {
            const mine = message.senderId === user?.id;
            return (
              <View key={message.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%', paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: mine ? colors.primary : colors.surface, borderColor: mine ? colors.primary : colors.border, borderWidth: mine ? 0 : 1, borderRadius: radius.lg, borderBottomRightRadius: mine ? radius.sm : radius.lg, borderBottomLeftRadius: mine ? radius.lg : radius.sm }}>
                <Text style={[type.body, { color: mine ? colors.primaryText : colors.text }]}>{message.body}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 }}>
                  <Text style={[type.footnote, { color: mine ? colors.primaryText : colors.muted, opacity: 0.8 }]}>{clock(message.createdAt)}</Text>
                  {mine ? <Text accessibilityLabel={message.readAt ? t('chat.read') : t('chat.sent')} style={[type.footnote, { color: mine ? colors.primaryText : colors.muted, opacity: 0.8 }]}>{message.readAt ? '✓✓' : '✓'}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      {/* Keep message history scrollable while the composer stays above the keyboard and system gesture area. */}
    </TabScreen>
  );
}
