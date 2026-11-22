import { EXPERTISE_IDS, type ExpertiseId } from '@meraceo/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { SelectField } from '@/components/select-field';
import { OpportunityShortlistButton, useOpportunityShortlist } from '@/features/needs/opportunity-shortlist';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/empty-state';
import { FilterPills } from '@/components/filter-pills';
import { TabScreen } from '@/components/tab-screen';
import { BellButton } from '@/features/notifications/bell-button';
import { SearchBar } from '@/components/search-bar';
import { useDebounced } from '@/components/use-debounced';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { activeFilterCount, FilterSheet, NO_FILTERS } from '@/features/discovery/filter-sheet';
import { OpportunityCard } from '@/features/needs/opportunity-card';
import { api, type Opportunity } from '@/lib/api';
import { t } from '@/i18n';

// Professional opportunities (PRD P5): the feed of open needs that fit their expertise.
// It can be searched and filtered by expertise and industry.
export default function ProfessionalHome() {
  const { colors, radius, space, type } = useTheme();
  const { token } = useSession();
  const shortlist = useOpportunityShortlist();
  const [onlyShortlisted, setOnlyShortlisted] = useState(false);
  const [sort, setSort] = useState<'relevance' | 'title'>('relevance');
  const [timeline, setTimeline] = useState('all');
  const [query, setQuery] = useState('');
  const [expertise, setExpertise] = useState<ExpertiseId | null>(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [feedFailed, setFeedFailed] = useState(false);
  const [feedReload, setFeedReload] = useState(0);
  const [items, setItems] = useState<Opportunity[] | null>(null);
  const [reload, setReload] = useState(0);
  const q = useDebounced(query.trim());

  // Reload the feed each time this tab comes into view.
  useFocusEffect(useCallback(() => setReload((n) => n + 1), []));

  // Search again whenever the words or a filter changes.
  useEffect(() => {
    if (!token) return;
    let stale = false;
    setFeedFailed(false);
    setItems(null);
    api
      .getOpportunities(token, { q, expertise, industry: filters.industry })
      .then((r) => !stale && setItems(r.opportunities))
      .catch(() => !stale && setFeedFailed(true));
    return () => {
      stale = true;
    };
  }, [token, q, expertise, filters.industry, reload, feedReload]);

  const filterCount = activeFilterCount(filters);
  const timelines = [...new Set((items ?? []).map((item) => item.timeline).filter((value): value is string => !!value))].sort();
  const shown = (items ?? []).filter((item) => (!onlyShortlisted || shortlist.ids.includes(item.id)) && (!filters.fee || item.budgetBand === filters.fee) && (!filters.format || item.format === filters.format) && (timeline === 'all' || item.timeline === timeline))
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : b.score - a.score);


  return (
    <TabScreen title={t('opp.title')} actions={<BellButton />}>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <SearchBar value={query} onChangeText={setQuery} hint={t('opp.searchHint')} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('filter.button')}
            onPress={() => setSheet(true)}
            style={{ width: 48, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: filterCount ? colors.primary : colors.border, backgroundColor: filterCount ? colors.blueSoft : colors.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="options-outline" size={22} color={colors.primary} />
          </Pressable>
        </View>
        <FilterPills
          pills={[{ value: null, label: t('filter.allExpertise') }, ...EXPERTISE_IDS.map((id) => ({ value: id, label: t(`expertise.${id}`) }))]}
          selected={expertise}
          onSelect={setExpertise}
        />
      </View>

      <View style={{ gap: space.md }}>
        <FilterPills pills={[{ value: 'all', label: t('opp.all') }, { value: 'shortlisted', label: t('opp.shortlisted') }]} selected={onlyShortlisted ? 'shortlisted' : 'all'} onSelect={(value) => setOnlyShortlisted(value === 'shortlisted')} />
        <Text style={[type.caption, { color: colors.muted }]}>{t('opp.shortlistDevice')}</Text>
        {shortlist.failed ? <Button label={t('common.retry')} onPress={shortlist.retry} /> : null}
        <SelectField label={t('opp.sort')} placeholder={t('common.select')} value={sort} options={[{ value: 'relevance', label: t('opp.sortRelevance') }, { value: 'title', label: t('opp.sortTitle') }]} onChange={setSort} />
        <SelectField label={t('opp.timeline')} placeholder={t('common.select')} value={timeline} options={[{ value: 'all', label: t('opp.allTimelines') }, ...timelines.map((value) => ({ value, label: value }))]} onChange={setTimeline} />
      </View>
      {feedFailed ? <View style={{ gap: space.sm }}><Text accessibilityRole="alert" style={[type.body, { color: colors.danger }]}>{t('common.genericError')}</Text><Button label={t('common.retry')} onPress={() => setFeedReload((value) => value + 1)} /></View> : items === null ? <ActivityIndicator color={colors.primary} /> : null}

      {onlyShortlisted && !shortlist.ready ? <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} /> : items && shown.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Text style={[type.caption, { color: colors.muted }]}>{shown.length === 1 ? t('opp.countOne') : t('opp.count', { count: shown.length })}</Text>
          {shown.map((item) => (
            <View key={item.id} style={{ gap: space.sm }}><OpportunityCard item={item} /><OpportunityShortlistButton id={item.id} /></View>
          ))}
        </View>
      ) : items ? (
        <EmptyState icon="search-outline" title={t('opp.emptyTitle')} body={t('opp.emptyBody')} />
      ) : null}

      <FilterSheet visible={sheet} onClose={() => setSheet(false)} filters={filters} onChange={setFilters} show={['industry', 'fee', 'format']} />
    </TabScreen>
  );
}
