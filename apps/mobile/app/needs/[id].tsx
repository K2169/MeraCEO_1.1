import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { MatchCard } from '@/features/needs/match-card';
import { api, type Match, type Need } from '@/lib/api';
import { t } from '@/i18n';

// Owner need details retain closed records while removing new matching actions.
export default function NeedMatches() {
  const { colors, space, type } = useTheme();
  const { token } = useSession();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [need, setNeed] = useState<Need | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeFailed, setCloseFailed] = useState(false);

  // Reload after editing and distinguish a network failure from empty matches.
  useFocusEffect(useCallback(() => {
    if (!token || !id) return;
    let stale = false;
    setFailed(false);
    setNeed(null);
    api.getNeed(token, id).then(async (record) => {
      const list = record.status === 'open' ? (await api.getMatches(token, id)).matches : [];
      if (!stale) { setNeed(record); setMatches(list); }
    }).catch(() => !stale && setFailed(true));
    return () => { stale = true; };
  }, [token, id, retry]));

  // The server scopes closing to this owner and leaves existing requests intact.
  async function close() {
    if (!token || !id || closing) return;
    setClosing(true);
    setCloseFailed(false);
    try {
      const record = await api.closeNeed(token, id);
      setNeed(record);
      setMatches([]);
      setConfirmClose(false);
    } catch { setCloseFailed(true); }
    finally { setClosing(false); }
  }

  return (
    <Screen back>
      {need ? (
        <>
          <View style={{ gap: space.md }}>
            <Text style={[type.title, { color: colors.text }]}>{need.title}</Text>
            <Text style={[type.caption, { color: colors.muted }]}>{t(need.status === 'open' ? 'need.open' : 'need.closed')}</Text>
            <Text style={[type.body, { color: colors.text }]}>{need.challenge}</Text>
            {need.timeline ? <View style={{ gap: space.xs }}><Text style={[type.caption, { color: colors.muted }]}>{t('need.timeline')}</Text><Text style={[type.body, { color: colors.text }]}>{need.timeline}</Text></View> : null}
            {need.goals ? <View style={{ gap: space.xs }}><Text style={[type.caption, { color: colors.muted }]}>{t('owner.goals')}</Text><Text style={[type.body, { color: colors.text }]}>{need.goals}</Text></View> : null}
            <Text style={[type.caption, { color: colors.muted }]}>{need.budgetBand ? t(`fee.${need.budgetBand}`) : t('need.noBudget')}</Text>
            {need.status === 'open' ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}><Button label={t('need.edit')} variant="secondary" onPress={() => router.push(`/needs/new?edit=${encodeURIComponent(need.id)}` as Href)} /></View>
                <View style={{ flex: 1 }}><Button label={t('need.close')} variant="secondary" onPress={() => { setCloseFailed(false); setConfirmClose(true); }} /></View>
              </View>
            ) : <Text style={[type.body, { color: colors.muted }]}>{t('need.closedBody')}</Text>}
          </View>
          {need.status === 'open' ? matches.length === 0 ? <EmptyState title={t('need.noMatchesTitle')} body={t('need.noMatchesBody')} /> : (
            <View style={{ gap: space.md }}>
              <Text style={[type.heading, { color: colors.text }]}>{t('need.matchCount', { count: matches.length })}</Text>
              {matches.map((match) => <MatchCard key={match.id} match={match} needId={need.id} />)}
            </View>
          ) : null}
        </>
      ) : failed ? (
        <View style={{ gap: space.md }}>
          <Text style={[type.body, { color: colors.danger }]}>{t('need.loadFailed')}</Text>
          <Button label={t('common.retry')} onPress={() => setRetry((value) => value + 1)} />
        </View>
      ) : <ActivityIndicator color={colors.primary} />}
      <BottomSheet visible={confirmClose} onClose={() => { if (!closing) setConfirmClose(false); }} title={t('need.closeTitle')}>
        <View style={{ gap: space.md }}>
          <Text style={[type.body, { color: colors.text }]}>{t('need.closeBody')}</Text>
          {closeFailed ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{t('need.editFailed')}</Text> : null}
          <Button label={t('need.close')} variant="danger" disabled={closing} onPress={close} />
          <Button label={t('common.cancel')} variant="secondary" disabled={closing} onPress={() => setConfirmClose(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
