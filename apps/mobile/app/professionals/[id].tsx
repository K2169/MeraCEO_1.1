import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Input } from '@/components/input';
import { OptionChips } from '@/components/option-chips';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { SaveButton } from '@/features/needs/save-button';
import { useSession } from '@/features/auth/session-provider';
import { placeLine } from '@/features/onboarding/wizard-utils';
import { api, ApiError, type ProfessionalProfile, type RequestStatus } from '@/lib/api';
import { t } from '@/i18n';

type OpenNeed = { id: string; title: string; requestStatus: RequestStatus | null };

// A label and value line inside a card.
function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors, space, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.md - 2, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <Text style={[type.body, { color: colors.muted }]}>{label}</Text>
      <Text style={[type.body, { color: colors.text, fontFamily: 'DMSans_500Medium', flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

// A white section card with a small title.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, radius, space, type } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm }}>
      <Text style={[type.heading, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

// Small rounded tags.
function Tags({ items }: { items: string[] }) {
  const { colors, radius, space, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {items.map((item) => (
        <View key={item} style={{ backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: space.md - 2, paddingVertical: 4 }}>
          <Text style={[type.caption, { color: colors.primary }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// A professional's public profile, opened from a match card. Same layout as the person's own Profile tab, plus a
// Send request button. No phone, LinkedIn or email: contact details are shared only after they accept.
export default function ProfessionalProfilePage() {
  const { colors, radius, space, type } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useSession();
  const [pro, setPro] = useState<ProfessionalProfile | null>(null);
  const [needs, setNeeds] = useState<OpenNeed[]>([]);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [needId, setNeedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the profile and the owner's open needs.
  useEffect(() => {
    if (!token || !id) return;
    api
      .getProfessional(token, id)
      .then((r) => {
        setPro(r.professional);
        setSaved(r.saved);
        setNeeds(r.needs);
        setNeedId(r.needs.find((n) => !n.requestStatus)?.id ?? null);
      })
      .catch(() => setFailed(true));
  }, [token, id]);

  // Send the request for the chosen need, then mark that need as waiting.
  async function send() {
    if (!token || !pro || !needId) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendRequest(token, { needId, professionalId: pro.id, note: note.trim() || undefined });
      setNeeds((list) => list.map((n) => (n.id === needId ? { ...n, requestStatus: 'pending' } : n)));
      setNeedId(null);
      setNote('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? t('request.exists') : t('request.sendFailed'));
    } finally {
      setBusy(false);
    }
  }

  const free = needs.filter((n) => !n.requestStatus);
  const place = pro ? placeLine({ city: pro.city, state: pro.state, country: pro.country }) : '';
  // The Details rows: only the ones this person has filled in.
  const details = pro
    ? [
        { label: t('profile.role'), value: [pro.designation, pro.company].filter(Boolean).join(', ') },
        { label: t('profile.years'), value: pro.yearsExperience !== null ? `${pro.yearsExperience} ${t('profile.yearsUnit')}` : '' },
        { label: t('profile.employment'), value: pro.employmentType ? t(`opt.employment.${pro.employmentType}`) : '' },
        { label: t('profile.industry'), value: pro.industry ? t(`industry.${pro.industry}`) : '' },
        { label: t('profile.fee'), value: pro.feeBand ? t(`fee.${pro.feeBand}`) : '' },
        { label: t('profile.formats'), value: pro.formats.map((f) => t(`format.${f}`)).join(', ') },
      ].filter((d) => d.value)
    : [];

  return (
    <TabScreen title={t('professional.title')} back actions={pro ? <SaveButton professionalId={pro.id} saved={saved} onChange={setSaved} /> : undefined}>
      {failed ? <Text style={[type.body, { color: colors.muted }]}>{t('professional.notFound')}</Text> : null}
      {!pro && !failed ? <ActivityIndicator color={colors.primary} /> : null}
      {pro ? (
        <>
          {/* Header card: colour band, photo overlapping its edge, name, headline, place and the main action */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            <View style={{ height: 76, backgroundColor: colors.blueSoft }} />
            <View style={{ padding: space.lg, paddingTop: 0, gap: space.xs }}>
              <View style={{ marginTop: -40, alignSelf: 'flex-start', marginBottom: space.xs, borderRadius: 48, borderWidth: 3, borderColor: colors.surface }}>
                <Avatar name={pro.name} url={pro.photoUrl} size={84} />
              </View>
              <Text style={[type.title, { color: colors.text }]}>{pro.name}</Text>
              <Text style={[type.body, { color: colors.text }]}>{pro.headline}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
                <Icon name="location-outline" size={15} color={colors.muted} />
                <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_500Medium' }]}>{place}</Text>
              </View>
              <View style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                {free.length > 0 ? (
                  <Button label={t('request.send')} small onPress={() => setOpen(true)} />
                ) : needs.length > 0 ? (
                  <View style={{ backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs }}>
                    <Text style={[type.caption, { color: colors.primary }]}>{t('professional.requested')}</Text>
                  </View>
                ) : (
                  <Button label={t('owner.postNeed')} variant="secondary" small onPress={() => router.push('/needs/new' as never)} />
                )}
              </View>
            </View>
          </View>

          {pro.experience ? (
            <Section title={t('profile.about')}>
              <Text style={[type.body, { color: colors.text }]}>{pro.experience}</Text>
            </Section>
          ) : null}

          {pro.expertise.length > 0 ? (
            <Section title={t('profile.expertise')}>
              <Tags items={pro.expertise.map((e) => t(`expertise.${e}`))} />
            </Section>
          ) : null}

          {details.length > 0 ? (
            <Section title={t('profile.details')}>
              <View>
                {details.map((d, i) => (
                  <Row key={d.label} label={d.label} value={d.value} last={i === details.length - 1} />
                ))}
              </View>
            </Section>
          ) : null}

          {pro.skills.length > 0 ? (
            <Section title={t('profile.skills')}>
              <Tags items={pro.skills} />
            </Section>
          ) : null}

          <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('request.sendTitle')}>
            <View style={{ gap: space.md, paddingBottom: space.md }}>
              <Text style={[type.body, { color: colors.muted }]}>{t('request.toPerson', { name: pro.name })}</Text>
              {free.length > 1 ? (
                <>
                  <Text style={[type.caption, { color: colors.muted }]}>{t('professional.chooseNeed')}</Text>
                  <OptionChips options={free.map((n) => ({ value: n.id, label: n.title }))} selected={needId ? [needId] : []} onChange={([v]) => setNeedId(v ?? null)} />
                </>
              ) : null}
              <Input label={t('request.noteLabel')} value={note} onChangeText={setNote} multiline />
              {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}
              <Button label={t('request.send')} onPress={send} disabled={busy || !needId} />
            </View>
          </BottomSheet>
        </>
      ) : null}
    </TabScreen>
  );
}
