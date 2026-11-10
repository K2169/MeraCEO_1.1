import { Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { useTheme } from '@/components/use-theme';
import { placeLine } from '@/features/onboarding/wizard-utils';
import type { Opportunity } from '@/lib/api';
import { t } from '@/i18n';

// One open business need in a professional's feed: what it is, who posted it, and how well it fits.
export function OpportunityCard({ item }: { item: Opportunity }) {
  const { colors, radius, space, type } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <Avatar name={item.business.name} url={item.business.photoUrl} size={44} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={[type.heading, { color: colors.text }]}>{item.title}</Text>
          <Text style={[type.caption, { color: colors.muted }]}>
            {t('opp.business', { business: item.business.name, place: placeLine({ city: item.business.city, state: item.business.state ?? undefined, country: item.business.country }) })}
          </Text>
        </View>
        <View style={{ backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs }}>
          <Text style={[type.caption, { color: colors.accentText }]}>{t('match.percent', { score: item.score })}</Text>
        </View>
      </View>
      <Text style={[type.body, { color: colors.text }]}>{item.challenge}</Text>
      <Text style={[type.caption, { color: colors.muted }]}>{item.expertise.map((id) => t(`expertise.${id}`)).join(', ')}</Text>
    </Card>
  );
}
