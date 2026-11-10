import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { MatchCard } from '@/features/needs/match-card';
import { NeedCard } from '@/features/needs/need-card';
import { RequestCard } from '@/features/requests/request-card';
import { Input } from '@/components/input';
import { StatusBadge } from '@/components/status-badge';
import { ThemeScope, useTheme } from '@/components/use-theme';
import { t } from '@/i18n';

// W1-08 dev screen: every base component in light and dark. Not linked from the product UI.
function ComponentSet() {
  const { colors, space, type } = useTheme();
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState(true);
  const error = value.trim() ? undefined : t('dev.inputError');

  return (
    <View style={{ gap: space.md }}>
      <MatchCard needId="demo" match={{ id: 'x', name: 'Arjun Kapoor', headline: 'Taking local brands to new countries', country: 'India', state: 'Delhi', city: 'Delhi', expertise: ['strategy'], industry: 'retail', feeBand: 'medium', formats: ['online'], requestStatus: null, score: 85, reasons: ['expertise', 'industry', 'format'], matchedExpertise: ['strategy'] }} />
      <NeedCard need={{ id: 'n', title: 'Improve our margins', challenge: 'x', expertise: ['strategy', 'finance'], industry: 'retail', budgetBand: 'medium', status: 'open' }} onPress={() => undefined} />
      <RequestCard viewer="owner" busy={false} onAction={() => undefined} onSchedule={async () => true} item={{ id: 'r1', status: 'pending', note: 'We would like a short call this week.', createdAt: '', scheduledAt: null, need: { id: 'n', title: 'Improve our margins' }, professional: { id: 'p', name: 'Arjun Kapoor', headline: 'Growth', photoUrl: null } }} />
      <RequestCard viewer="professional" busy={false} onAction={() => undefined} onSchedule={async () => true} item={{ id: 'r2', status: 'accepted', note: null, createdAt: '', scheduledAt: new Date(Date.now() + 86400000).toISOString(), need: { id: 'n', title: 'Improve our margins', challenge: 'Our costs have grown and profit is shrinking every quarter.' }, owner: { name: 'Kiran Nair', businessName: 'Nair Traders', industry: 'retail', city: 'Cochin', state: 'Kerala', country: 'India', photoUrl: null } }} />
      <Button label={t('dev.primary')} onPress={() => undefined} />
      <Button label={t('dev.secondary')} variant="secondary" onPress={() => undefined} />
      <Button label={t('dev.ghost')} variant="ghost" onPress={() => undefined} />
      <Input
        label={t('dev.inputLabel')}
        placeholder={t('dev.inputPlaceholder')}
        value={value}
        onChangeText={setValue}
        error={error}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip label={t('dev.chip')} selected={selected} onPress={() => setSelected(!selected)} />
        <Chip label={t('dev.chip')} />
      </View>
      <Card>
        <Text style={[type.heading, { color: colors.text }]}>{t('dev.title')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <StatusBadge status="pending" />
          <StatusBadge status="accepted" />
          <StatusBadge status="declined" />
          <StatusBadge status="cancelled" />
          <StatusBadge status="completed" />
        </View>
      </Card>
      <EmptyState
        title={t('dev.emptyTitle')}
        body={t('dev.emptyBody')}
      />
    </View>
  );
}

// DEV ONLY: shows every base component in light and dark. Remove before release (see docs/DECISIONS.md).
export default function ComponentsDevScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 26, fontFamily: 'DMSans_700Bold' }}>{t('dev.title')}</Text>
      <Text>{t('dev.light')}</Text>
      <ThemeScope scheme="light">
        <ComponentSet />
      </ThemeScope>
      <Text>{t('dev.dark')}</Text>
      <ThemeScope scheme="dark">
        <ComponentSet />
      </ThemeScope>
    </ScrollView>
  );
}
