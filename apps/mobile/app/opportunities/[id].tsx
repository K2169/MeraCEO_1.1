import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { TabScreen } from '@/components/tab-screen';
import { useTheme } from '@/components/use-theme';
import { placeLine } from '@/features/onboarding/wizard-utils';
import { ApiError, api, type OpportunityDetail } from '@/lib/api';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';

// A labeled value row for the opportunity and public business details.
function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors, space, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={[type.body, { color: colors.muted }]}>{label}</Text>
      <Text style={[type.body, { color: colors.text, fontFamily: 'DMSans_500Medium', flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

// A calm section card that groups related details.
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, radius, space, type } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm }}>
      <Text style={[type.heading, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

// Show one open opportunity only if the API confirms it is visible and relevant to this professional.
export default function OpportunityDetails() {
  const { colors, radius, space, type } = useTheme();
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed' | 'missing'>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!token || !id) return;
    let active = true;
    setState('loading');
    api.getOpportunity(token, id)
      .then(({ opportunity: result }) => {
        if (!active) return;
        setOpportunity(result);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setOpportunity(null);
        setState(error instanceof ApiError && error.status === 404 ? 'missing' : 'failed');
      });
    return () => { active = false; };
  }, [token, id, retry]);

  const reasonText = (item: OpportunityDetail, reason: OpportunityDetail['reasons'][number]) => {
    if (reason === 'expertise') return t('match.reasonExpertise', { areas: item.matchedExpertise.map((value) => t(`expertise.${value}`)).join(', ') });
    if (reason === 'industry') return t('match.reasonIndustry');
    if (reason === 'budget') return t('match.reasonBudget');
    if (reason === 'business_profile') return t('match.reasonBusinessProfile');
    return t('match.reasonFormat');
  };

  return (
    <TabScreen title={t('opp.detailTitle')} back>
      {state === 'loading' ? (
        <ActivityIndicator color={colors.primary} />
      ) : state === 'missing' ? (
        <Text style={[type.body, { color: colors.muted }]}>{t('opp.notFound')}</Text>
      ) : state === 'ready' && opportunity ? (
        <>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Avatar name={opportunity.business.name} url={opportunity.business.photoUrl} size={52} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Text style={[type.heading, { color: colors.text }]}>{opportunity.business.name}</Text>
                <Text style={[type.caption, { color: colors.muted }]}>{placeLine({ city: opportunity.business.city, state: opportunity.business.state ?? undefined, country: opportunity.business.country })}</Text>
              </View>
            </View>
            <Text style={[type.title, { color: colors.text, marginTop: space.sm }]}>{opportunity.title}</Text>
            <View style={{ alignSelf: 'flex-start', backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs }}>
              <Text style={[type.caption, { color: colors.accentText }]}>{t('match.percent', { score: opportunity.score })}</Text>
            </View>
          </View>

          <DetailSection title={t('need.newTitle')}>
            <Text style={[type.body, { color: colors.text }]}>{opportunity.challenge}</Text>
            {opportunity.goals ? <Text style={[type.body, { color: colors.text }]}>{opportunity.goals}</Text> : null}
            <DetailRow label={t('opp.timeline')} value={opportunity.timeline ?? '—'} />
            {opportunity.budgetBand ? <DetailRow label={t('owner.budget')} value={t(`fee.${opportunity.budgetBand}`)} /> : null}
            {opportunity.format ? <DetailRow label={t('opp.mode')} value={t(`format.${opportunity.format}`)} /> : null}
            <Text style={[type.caption, { color: colors.muted }]}>{opportunity.expertise.map((value) => t(`expertise.${value}`)).join(', ')}</Text>
          </DetailSection>

          <DetailSection title={t('opp.businessContext')}>
            {opportunity.business.description ? <Text style={[type.body, { color: colors.text }]}>{opportunity.business.description}</Text> : null}
            <DetailRow label={t('owner.industry')} value={t(`industry.${opportunity.business.industry}`)} />
            {opportunity.business.businessType ? <DetailRow label={t('owner.businessType')} value={t(`opt.businessType.${opportunity.business.businessType}`)} /> : null}
            {opportunity.business.sector ? <DetailRow label={t('owner.sector')} value={t(`opt.sector.${opportunity.business.sector}`)} /> : null}
            {opportunity.business.teamSize ? <DetailRow label={t('owner.teamSize')} value={t(`opt.teamSize.${opportunity.business.teamSize}`)} /> : null}
            {opportunity.business.revenue ? <DetailRow label={t('owner.revenue')} value={t(`opt.revenue.${opportunity.business.revenue}`)} /> : null}
          </DetailSection>

          {opportunity.reasons.length ? (
            <DetailSection title={t('opp.matchReasonsTitle')}>
              {opportunity.reasons.map((reason) => <Text key={reason} style={[type.body, { color: colors.text }]}>• {reasonText(opportunity, reason)}</Text>)}
            </DetailSection>
          ) : null}
        </>
      ) : (
        <View style={{ gap: space.md }}>
          <Text style={[type.body, { color: colors.danger }]}>{t('opp.loadFailed')}</Text>
          <Button label={t('common.retry')} variant="secondary" onPress={() => setRetry((value) => value + 1)} />
        </View>
      )}
    </TabScreen>
  );
}
