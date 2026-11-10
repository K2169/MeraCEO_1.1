import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { placeLine } from '@/features/onboarding/wizard-utils';
import { api } from '@/lib/api';
import { usePhoto } from './use-photo';
import { t } from '@/i18n';

type Profile = Record<string, unknown>;

// One label and value line inside the Details card.
function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors, space, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.md - 2, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <Text style={[type.body, { color: colors.muted }]}>{label}</Text>
      <Text style={[type.body, { color: colors.text, fontFamily: 'DMSans_500Medium', flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

// A white section card with a small title, like the sections on a professional network profile.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, radius, space, type } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm }}>
      <Text style={[type.heading, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

// Small rounded tags (expertise, skills).
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

// The last tab of each home: the person's own profile, shown the way others see it. Owners see "Account",
// professionals see "Profile". Settings (privacy, data, sign out) live behind the gear in the top right.
export function AccountScreen() {
  const { colors, radius, space, type } = useTheme();
  const router = useRouter();
  const { user, token } = useSession();
  const isOwner = user?.role === 'owner';
  const [profile, setProfile] = useState<Profile | null>(null);
  const photo = usePhoto();

  // Load the saved profile.
  useEffect(() => {
    if (token) api.getProfile(token).then((p) => setProfile(p.data)).catch(() => undefined);
  }, [token]);

  const str = (key: string) => (typeof profile?.[key] === 'string' ? (profile[key] as string) : '');
  const list = (key: string) => (Array.isArray(profile?.[key]) ? (profile[key] as string[]) : []);
  const name = (isOwner ? str('ownerName') : str('name')) || user?.name || '';
  const place = profile ? placeLine({ city: str('city'), state: str('state') || undefined, country: str('country') }) : '';
  const headline = isOwner ? [str('designation'), str('businessName')].filter(Boolean).join(' at ') : str('headline');
  const review = user?.moderation;
  const reviewLabel = review === 'approved' ? t('account.reviewApproved') : review === 'hidden' ? t('account.reviewHidden') : t('account.reviewPending');

  // The Details card rows: only the ones the person has filled in.
  const details: { label: string; value: string }[] = isOwner
    ? [
        { label: t('profile.industry'), value: str('industry') ? t(`industry.${str('industry')}`) : '' },
        { label: t('owner.businessType'), value: str('businessType') ? t(`opt.businessType.${str('businessType')}`) : '' },
        { label: t('owner.revenue'), value: str('revenue') ? t(`opt.revenue.${str('revenue')}`) : '' },
        { label: t('owner.teamSize'), value: str('teamSize') ? t(`opt.teamSize.${str('teamSize')}`) : '' },
        { label: t('profile.established'), value: profile?.yearEstablished ? String(profile.yearEstablished) : '' },
        { label: t('profile.website'), value: str('website') },
      ]
    : [
        { label: t('profile.role'), value: [str('designation'), str('company')].filter(Boolean).join(', ') },
        { label: t('profile.years'), value: profile?.yearsExperience !== undefined ? `${profile.yearsExperience} ${t('profile.yearsUnit')}` : '' },
        { label: t('profile.employment'), value: str('employmentType') ? t(`opt.employment.${str('employmentType')}`) : '' },
        { label: t('profile.industry'), value: str('industry') ? t(`industry.${str('industry')}`) : '' },
        { label: t('profile.fee'), value: str('feeBand') ? t(`fee.${str('feeBand')}`) : '' },
        { label: t('profile.formats'), value: list('formats').map((f) => t(`format.${f}`)).join(', ') },
      ];
  const shownDetails = details.filter((d) => d.value);
  const about = isOwner ? str('description') : str('experience');

  return (
    <TabScreen
      title={isOwner ? t('tab.account') : t('tab.profile')}
      actions={
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.openSettings')} onPress={() => router.push('/settings' as Href)} hitSlop={10} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="settings-outline" size={22} color={colors.text} />
        </Pressable>
      }
    >
      {/* Header card: a colour band, the photo overlapping its edge, name, headline, place, status and actions */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
        <View style={{ height: 76, backgroundColor: colors.blueSoft }} />
        <View style={{ padding: space.lg, paddingTop: 0, gap: space.xs }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t(isOwner ? 'photo.changeLogo' : 'photo.change')} onPress={photo.pick} disabled={photo.busy} style={{ marginTop: -40, alignSelf: 'flex-start', marginBottom: space.xs }}>
            <View style={{ borderRadius: 48, borderWidth: 3, borderColor: colors.surface }}>
              <Avatar name={name} url={user?.photoUrl} size={84} icon={isOwner ? 'business' : 'person'} />
            </View>
            <View style={{ position: 'absolute', right: 0, bottom: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={photo.busy ? 'cloud-upload' : 'camera'} size={13} color={colors.primaryText} />
            </View>
          </Pressable>
          <Text numberOfLines={2} style={[type.title, { color: colors.text }]}>{name}</Text>
          {headline ? <Text numberOfLines={2} style={[type.body, { color: colors.text }]}>{headline}</Text> : null}
          {place ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
              <Icon name="location-outline" size={15} color={colors.muted} />
              <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_500Medium' }]}>{place}</Text>
            </View>
          ) : null}
          {!isOwner && review ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: review === 'approved' ? colors.greenSoft : colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: space.md - 2, paddingVertical: 3, marginTop: space.xs }}>
              <Text style={[type.caption, { color: review === 'approved' ? colors.accentText : colors.primary }]}>{reviewLabel}</Text>
            </View>
          ) : null}
          <View style={{ marginTop: space.md, flexDirection: 'row', gap: space.sm }}>
            <Button label={t('account.editProfile')} variant="secondary" small onPress={() => router.push('/account/edit' as Href)} />
            {user?.photoUrl ? <Button label={t(isOwner ? 'photo.removeLogo' : 'photo.remove')} variant="secondary" small onPress={photo.remove} /> : null}
          </View>
          {photo.failed ? <Text style={[type.caption, { color: colors.danger }]}>{t('photo.failed')}</Text> : null}
        </View>
      </View>

      {about ? (
        <Section title={t('profile.about')}>
          <Text style={[type.body, { color: colors.text }]}>{about}</Text>
        </Section>
      ) : null}

      {!isOwner && list('expertise').length > 0 ? (
        <Section title={t('profile.expertise')}>
          <Tags items={list('expertise').map((id) => t(`expertise.${id}`))} />
        </Section>
      ) : null}

      {shownDetails.length > 0 ? (
        <Section title={t('profile.details')}>
          <View>
            {shownDetails.map((d, i) => (
              <DetailRow key={d.label} label={d.label} value={d.value} last={i === shownDetails.length - 1} />
            ))}
          </View>
        </Section>
      ) : null}

      {!isOwner && list('skills').length > 0 ? (
        <Section title={t('profile.skills')}>
          <Tags items={list('skills')} />
        </Section>
      ) : null}
    </TabScreen>
  );
}
