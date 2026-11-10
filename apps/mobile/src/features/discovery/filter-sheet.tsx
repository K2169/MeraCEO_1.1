import { type FeeBand, type Format, type IndustryId } from '@meraceo/shared';
import { ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { OptionChips } from '@/components/option-chips';
import { useTheme } from '@/components/use-theme';
import { feeOptions, formatOptions, industryOptions } from '@/features/onboarding/options';
import { t } from '@/i18n';

export interface Filters {
  industry: IndustryId | null;
  fee: FeeBand | null;
  format: Format | null;
}

export const NO_FILTERS: Filters = { industry: null, fee: null, format: null };

// How many filters are switched on, for the dot on the Filters button.
export const activeFilterCount = (f: Filters) => [f.industry, f.fee, f.format].filter(Boolean).length;

// The Filters bottom sheet. `show` says which groups to offer: owners get all three, professionals only industry.
// Tapping a chip that is already chosen clears it.
export function FilterSheet({ visible, onClose, filters, onChange, show }: { visible: boolean; onClose: () => void; filters: Filters; onChange: (next: Filters) => void; show: (keyof Filters)[] }) {
  const { colors, space, type } = useTheme();
  const group = (label: string, body: React.ReactNode) => (
    <View style={{ gap: space.sm }}>
      <Text style={[type.caption, { color: colors.muted }]}>{label}</Text>
      {body}
    </View>
  );
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('filter.title')}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg, paddingBottom: space.md }}>
        {show.includes('industry')
          ? group(t('filter.industry'), <OptionChips options={industryOptions()} selected={filters.industry ? [filters.industry] : []} onChange={(v) => onChange({ ...filters, industry: v[0] === filters.industry ? null : (v[0] ?? null) })} />)
          : null}
        {show.includes('fee')
          ? group(t('filter.fee'), <OptionChips options={feeOptions()} selected={filters.fee ? [filters.fee] : []} onChange={(v) => onChange({ ...filters, fee: v[0] === filters.fee ? null : (v[0] ?? null) })} />)
          : null}
        {show.includes('format')
          ? group(t('filter.format'), <OptionChips options={formatOptions()} selected={filters.format ? [filters.format] : []} onChange={(v) => onChange({ ...filters, format: v[0] === filters.format ? null : (v[0] ?? null) })} />)
          : null}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Button label={t('filter.clear')} variant="secondary" onPress={() => onChange(NO_FILTERS)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t('filter.apply')} onPress={onClose} />
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
