import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { SaveButton } from './save-button';
import { Input } from '@/components/input';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { api, ApiError, type Match, type RequestStatus } from '@/lib/api';
import { placeLine } from '@/features/onboarding/wizard-utils';
import { t } from '@/i18n';

// Turns each match reason into a short sentence the owner can read.
function reasonText(match: Match, reason: Match['reasons'][number]): string {
  if (reason === 'expertise') return t('match.reasonExpertise', { areas: match.matchedExpertise.map((id) => t(`expertise.${id}`)).join(', ') });
  if (reason === 'industry') return t('match.reasonIndustry');
  if (reason === 'budget') return t('match.reasonBudget');
  return t('match.reasonFormat');
}

// One professional ranked for a need: name, headline, where they are, the score and why they match.
// Without a need there is nothing to send a request about, so the Send button is left out.
export function MatchCard({ match, needId }: { match: Match; needId?: string }) {
  const { colors, radius, space, type } = useTheme();
  const { token } = useSession();
  const router = useRouter();
  // Status of the request for this person: starts from the server value and changes after sending.
  const [status, setStatus] = useState<RequestStatus | null>(match.requestStatus);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Send the request with the optional note, then show it as waiting for a reply.
  async function send() {
    if (!token || !needId) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendRequest(token, { needId, professionalId: match.id, note: note.trim() || undefined });
      setStatus('pending');
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? t('request.exists') : t('request.sendFailed'));
    } finally {
      setBusy(false);
    }
  }

  // A request that is still open (waiting or accepted) replaces the button with its status.
  const hasOpenRequest = status === 'pending' || status === 'accepted';
  return (
    <Card>
      {/* Top: photo, then the name with the headline under it */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Pressable accessibilityRole="button" onPress={() => router.push(`/professionals/${match.id}` as Href)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={match.name} url={match.photoUrl} size={44} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[type.heading, { color: colors.text }]}>{match.name}</Text>
            <Text numberOfLines={2} style={[type.body, { color: colors.muted }]}>{match.headline}</Text>
          </View>
        </Pressable>
        <View style={{ marginRight: -8 }}>
          <SaveButton professionalId={match.id} saved={!!match.saved} />
        </View>
      </View>

      {/* Place, with a small pin */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
        <Icon name="location-outline" size={15} color={colors.muted} />
        <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_500Medium' }]}>{placeLine(match)}</Text>
      </View>

      {/* Why they match, as small tags */}
      {match.reasons.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs }}>
          {match.reasons.map((reason) => (
            <View key={reason} style={{ backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: space.md - 2, paddingVertical: 4 }}>
              <Text style={[type.caption, { color: colors.primary, fontFamily: 'DMSans_600SemiBold' }]}>{reasonText(match, reason)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Footer: a thin line, the match score on the left, the request status or Send button on the right */}
      {needId || match.score > 0 ? (
        <View style={{ marginTop: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {match.score > 0 ? (
            <View style={{ backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: space.md - 2, paddingVertical: 3 }}>
              <Text style={[type.caption, { color: colors.accentText }]}>{t('match.percent', { score: match.score })}</Text>
            </View>
          ) : <View />}
          {needId ? (
            hasOpenRequest ? (
              <View style={{ backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs }}>
                <Text style={[type.caption, { color: colors.primary }]}>{t(`status.${status}`)}</Text>
              </View>
            ) : (
              <Button label={t('request.send')} onPress={() => setOpen(true)} small />
            )
          ) : null}
        </View>
      ) : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('request.sendTitle')}>
        <View style={{ gap: space.md, paddingBottom: space.md }}>
          <Text style={[type.body, { color: colors.muted }]}>{t('request.toPerson', { name: match.name })}</Text>
          <Input label={t('request.noteLabel')} value={note} onChangeText={setNote} multiline />
          {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}
          <Button label={t('request.send')} onPress={send} disabled={busy} />
        </View>
      </BottomSheet>
    </Card>
  );
}
