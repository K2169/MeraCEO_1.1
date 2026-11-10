import { EXPERTISE_IDS, type ExpertiseId } from '@meraceo/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card } from '@/components/card';
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

// Professional home (PRD section 08): the opportunity feed of open needs that fit their expertise.
// It can be searched and filtered by expertise and industry. A notice shows until the profile is reviewed.
export default function ProfessionalHome() {
  const { colors, radius, space, type } = useTheme();
  const { token, user } = useSession();
  const [query, setQuery] = useState('');
  const [expertise, setExpertise] = useState<ExpertiseId | null>(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [items, setItems] = useState<Opportunity[] | null>(null);
  const [reload, setReload] = useState(0);
  const q = useDebounced(query.trim());

  // Reload the feed each time this tab comes into view.
  useFocusEffect(useCallback(() => setReload((n) => n + 1), []));

  // Search again whenever the words or a filter changes.
  useEffect(() => {
    if (!token) return;
    let stale = false;
    api
      .getOpportunities(token, { q, expertise, industry: filters.industry })
      .then((r) => !stale && setItems(r.opportunities))
      .catch(() => !stale && setItems([]));
    return () => {
      stale = true;
    };
  }, [token, q, expertise, filters.industry, reload]);

  const filterCount = activeFilterCount(filters);

  return (
    <TabScreen title={t('opp.title')} actions={<BellButton />}>

      {user?.moderation === 'pending_review' ? (
        <Card tint="green">
          <Text style={[type.heading, { color: colors.text }]}>{t('pro.pendingTitle')}</Text>
          <Text style={[type.body, { color: colors.muted }]}>{t('pro.pendingBody')}</Text>
        </Card>
      ) : null}

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

      {items && items.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Text style={[type.caption, { color: colors.muted }]}>{items.length === 1 ? t('opp.countOne') : t('opp.count', { count: items.length })}</Text>
          {items.map((item) => (
            <OpportunityCard key={item.id} item={item} />
          ))}
        </View>
      ) : items ? (
        <EmptyState icon="search-outline" title={t('opp.emptyTitle')} body={t('opp.emptyBody')} />
      ) : null}

      <FilterSheet visible={sheet} onClose={() => setSheet(false)} filters={filters} onChange={setFilters} show={['industry']} />
    </TabScreen>
  );
}
