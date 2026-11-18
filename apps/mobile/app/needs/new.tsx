import { type CreateNeedInput } from '@meraceo/shared';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { NeedEditor } from '@/features/needs/need-editor';
import { api, type Need } from '@/lib/api';
import { t } from '@/i18n';

// The same owner-only editor creates a need or updates an existing open need.
export default function NewNeed() {
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { token } = useSession();
  const [initial, setInitial] = useState<Partial<CreateNeedInput> | null>(null);
  const [existingNeeds, setExistingNeeds] = useState<Need[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [closed, setClosed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!token) return;
    let stale = false;
    setFailed(false);
    setInitial(null);
    setExistingNeeds(null);
    if (edit) {
      Promise.all([api.getNeed(token, edit), api.getNeeds(token)]).then(([need, { needs }]) => {
        if (stale) return;
        setClosed(need.status === 'closed');
        setInitial(need as Partial<CreateNeedInput>);
        setExistingNeeds(needs);
      }).catch(() => !stale && setFailed(true));
    } else {
      Promise.all([api.getProfile(token).catch(() => null), api.getNeeds(token)]).then(([profile, { needs }]) => {
        if (stale) return;
        setInitial(profile ? { industry: profile.data.industry as CreateNeedInput['industry'] } : {});
        setExistingNeeds(needs);
      }).catch(() => !stale && setFailed(true));
    }
    return () => { stale = true; };
  }, [token, edit, retry]);

  async function save(input: CreateNeedInput) {
    if (!token) throw new Error('No session');
    const need = edit ? await api.updateNeed(token, edit, input) : await api.createNeed(token, input);
    router.replace(`/needs/${need.id}` as Href);
  }

  return (
    <Screen back>
      <View style={{ gap: space.xs }}>
        <Text style={[type.title, { color: colors.text }]}>{t(edit ? 'need.edit' : 'need.newTitle')}</Text>
        {!edit ? <Text style={[type.body, { color: colors.muted }]}>{t('need.newSubtitle')}</Text> : null}
      </View>
      {closed ? <Text style={[type.body, { color: colors.muted }]}>{t('need.closedBody')}</Text> : initial && existingNeeds ? (
        <NeedEditor key={edit ?? 'new'} initial={initial} existingNeeds={existingNeeds} excludeNeedId={edit} onSave={save} editing={Boolean(edit)} />
      ) : failed ? (
        <View style={{ gap: space.md }}>
          <Text style={[type.body, { color: colors.danger }]}>{t('need.loadFailed')}</Text>
          <Button label={t('common.retry')} onPress={() => setRetry((value) => value + 1)} />
        </View>
      ) : <ActivityIndicator color={colors.primary} />}
    </Screen>
  );
}
