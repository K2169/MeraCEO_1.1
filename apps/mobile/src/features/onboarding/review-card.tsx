import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/components/use-theme';
import { t } from '@/i18n';

export interface ReviewRow {
  label: string;
  value: string;
  step: number;
}

export interface ReviewSection {
  title: string;
  step: number;
  rows: Omit<ReviewRow, 'step'>[];
}

// The last onboarding step: grouped answers with a clear, accessible edit action for each source section.
export function ReviewCard({ rows = [], sections, onEdit, hideEmptyRows = false }: { rows?: ReviewRow[]; sections?: ReviewSection[]; onEdit: (step: number) => void; hideEmptyRows?: boolean }) {
  const { colors, radius, space, type } = useTheme();
  const groups = sections ?? [...new Set(rows.map((row) => row.step))].map((step) => ({
    title: '',
    step,
    rows: rows.filter((row) => row.step === step).map(({ label, value }) => ({ label, value })),
  }));
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      rows: hideEmptyRows ? group.rows.filter((row) => row.value.trim().length > 0) : group.rows,
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <View style={{ gap: space.md }}>
      {visibleGroups.map((group) => (
        <View key={group.step} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, borderWidth: 1, borderColor: colors.border }}>
          {group.title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginBottom: space.sm }}>
              <Text accessibilityRole="header" style={[type.heading, { color: colors.text, flex: 1 }]}>{group.title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.editSection', { section: group.title })}
                onPress={() => onEdit(group.step)}
                style={({ pressed }) => ({ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: space.xs, opacity: pressed ? 0.68 : 1 })}
              >
                <Text style={[type.caption, { color: colors.primary }]}>{t('onboarding.edit')}</Text>
              </Pressable>
            </View>
          ) : null}
          {group.rows.map((row, index) => (
            <View key={`${group.step}-${row.label}`} style={{ paddingVertical: space.sm, borderTopWidth: index === 0 && !group.title ? 0 : 1, borderTopColor: colors.border }}>
              <Text style={[type.caption, { color: colors.muted }]}>{row.label}</Text>
              <Text style={[type.body, { color: colors.text }]}>{row.value || '—'}</Text>
            </View>
          ))}
          {!group.title ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.editSection', { section: t('common.step', { current: group.step + 1, total: visibleGroups.length }) })}
              onPress={() => onEdit(group.step)}
              style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: space.xs, opacity: pressed ? 0.68 : 1 })}
            >
              <Text style={[type.caption, { color: colors.primary }]}>{t('onboarding.edit')}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
