import { EXPERTISE_IDS, type ExpertiseId } from '@meraceo/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

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
import { MatchCard } from '@/features/needs/match-card';
import { api, type Match, type Need } from '@/lib/api';
import { t } from '@/i18n';

// Owner home, Discover (PRD section 07): search every approved professional, filter by expertise, industry,
// fee and format, and rank them by how well they fit one of your needs.
export default function OwnerDiscover() {
  const { colors, radius, space, type } = useTheme();
  const { token } = useSession();
  const [query, setQuery] = useState('');
  const [expertise, setExpertise] = useState<ExpertiseId | null>(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [needId, setNeedId] = useState<string | null>(null);
  const [results, setResults] = useState<Match[] | null>(null);
  const q = useDebounced(query.trim());

  // Reload the owner's open needs whenever the tab comes into view (they may have posted one).
  useFocusEffect(
    useCallback(() => {
      if (token) api.getNeeds(token).then((r) => setNeeds(r.needs.filter((n) => n.status === 'open'))).catch(() => undefined);
    }, [token]),
  );

  // Search again whenever the words, a filter or the chosen need changes.
  useEffect(() => {
    if (!token) return;
    let stale = false;
    api
      .searchProfessionals(token, { q, expertise, needId, saved: onlySaved ? 'true' : null, ...filters })
      .then((r) => !stale && setResults(r.professionals))
      .catch(() => !stale && setResults([]));
    return () => {
      stale = true;
    };
  }, [token, q, expertise, needId, filters, needs.length, onlySaved]);

  // A request needs a need: the one picked, else the one this person fits best, else the newest.
  const fallbackNeed = needId ?? needs[0]?.id;
  const filterCount = activeFilterCount(filters);

  return (
    <TabScreen title={t('discover.title')} actions={<BellButton />}>

      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <SearchBar value={query} onChangeText={setQuery} hint={t('discover.searchHint')} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: onlySaved }}
            accessibilityLabel={t('saved.show')}
            onPress={() => setOnlySaved((v) => !v)}
            style={{ width: 48, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: onlySaved ? colors.primary : colors.border, backgroundColor: onlySaved ? colors.blueSoft : colors.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="bookmark" size={22} color={onlySaved ? colors.primary : colors.muted} filled={onlySaved} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('filter.button')}
            onPress={() => setSheet(true)}
            style={{ width: 48, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: filterCount ? colors.primary : colors.border, backgroundColor: filterCount ? colors.blueSoft : colors.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="options-outline" size={22} color={colors.primary} />
            {filterCount ? (
              <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.primaryText, fontSize: 12, fontFamily: 'DMSans_700Bold' }}>{filterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <FilterPills
          pills={[{ value: null, label: t('filter.allExpertise') }, ...EXPERTISE_IDS.map((id) => ({ value: id, label: t(`expertise.${id}`) }))]}
          selected={expertise}
          onSelect={setExpertise}
        />
        {needs.length > 0 ? (
          <FilterPills
            pills={[{ value: null, label: t('filter.allNeeds') }, ...needs.map((n) => ({ value: n.id, label: n.title }))]}
            selected={needId}
            onSelect={setNeedId}
          />
        ) : null}
      </View>

      {results ? (
        results.length > 0 ? (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[type.caption, { color: colors.muted }]}>{results.length === 1 ? t('discover.countOne') : t('discover.count', { count: results.length })}</Text>
              <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_500Medium' }]}>{t('discover.sorted')}</Text>
            </View>
            {results.map((match) => (
              <MatchCard key={match.id} match={match} needId={match.needId ?? fallbackNeed} />
            ))}
          </View>
        ) : (
          <EmptyState icon={onlySaved ? 'bookmark' : 'search-outline'} title={onlySaved ? t('saved.emptyTitle') : t('discover.emptyTitle')} body={onlySaved ? t('saved.emptyBody') : t('discover.emptyBody')} />
        )
      ) : null}

      <FilterSheet visible={sheet} onClose={() => setSheet(false)} filters={filters} onChange={setFilters} show={['industry', 'fee', 'format']} />
    </TabScreen>
  );
}
