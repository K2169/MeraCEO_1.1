import { Text, View } from 'react-native';

import { useTheme } from '@/components/use-theme';
import { t } from '@/i18n';

export interface ReviewRow {
  label: string;
  value: string;
  step: number; // the step this answer was given on, so Edit can jump back to it
}

// The last onboarding step: one compact card listing the answers, each with an Edit link back to its step.
export function ReviewCard({ rows, onEdit }: { rows: ReviewRow[]; onEdit: (step: number) => void }) {
  const { colors, radius, space, type } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.border }}>
      {rows.map((row, i) => (
        <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <Text style={[type.caption, { color: colors.muted }]}>{row.label}</Text>
            <Text numberOfLines={1} style={[type.body, { color: colors.text }]}>
              {row.value || '—'}
            </Text>
          </View>
          <Text accessibilityRole="button" onPress={() => onEdit(row.step)} style={[type.caption, { color: colors.primary }]}>
            {t('onboarding.edit')}
          </Text>
        </View>
      ))}
    </View>
  );
}
