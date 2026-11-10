import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { MatchCard } from '@/features/needs/match-card';
import { api, type Match, type Need } from '@/lib/api';
import { t } from '@/i18n';

// Matches for one need: the need at the top, then professionals ranked best first.
export default function NeedMatches() {
  const { colors, space, type } = useTheme();
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ need: Need; matches: Match[] } | null>(null);
  const [failed, setFailed] = useState(false);

  // Load the ranked matches when the screen opens.
  useEffect(() => {
    if (!token || !id) return;
    api.getMatches(token, id).then(setData).catch(() => setFailed(true));
  }, [token, id]);

  return (
    <Screen back>
      {data ? (
        <>
          <View style={{ gap: space.xs }}>
            <Text style={[type.title, { color: colors.text }]}>{data.need.title}</Text>
            <Text style={[type.body, { color: colors.muted }]}>
              {data.matches.length === 1 ? t('need.matchCountOne') : t('need.matchCount', { count: data.matches.length })}
            </Text>
          </View>
          {data.matches.length === 0 ? (
            <EmptyState title={t('need.noMatchesTitle')} body={t('need.noMatchesBody')} />
          ) : (
            <View style={{ gap: space.md }}>
              {data.matches.map((match) => (
                <MatchCard key={match.id} match={match} needId={data.need.id} />
              ))}
            </View>
          )}
        </>
      ) : failed ? (
        <Text style={[type.body, { color: colors.danger }]}>{t('need.loadFailed')}</Text>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </Screen>
  );
}
