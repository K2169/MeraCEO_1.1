import { Pressable, ScrollView, Text } from 'react-native';

import { useTheme } from './use-theme';

export interface Pill<T extends string> {
  value: T | null; // null means "all"
  label: string;
}

// A sideways-scrolling row of small pills where exactly one is selected. Used for expertise and needs.
export function FilterPills<T extends string>({ pills, selected, onSelect }: { pills: Pill<T>[]; selected: T | null; onSelect: (value: T | null) => void }) {
  const { colors, radius, space } = useTheme();
  return (
    // The negative margin lets the row scroll edge to edge while the first pill lines up with the page.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }} style={{ marginHorizontal: -space.xl, flexGrow: 0 }}>
      {pills.map((pill) => {
        const on = pill.value === selected;
        return (
          <Pressable
            key={pill.value ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(pill.value)}
            style={{
              paddingHorizontal: space.md + 2,
              height: 34,
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: on ? colors.primary : colors.surface,
              borderWidth: 1.5,
              borderColor: on ? colors.primary : colors.border,
            }}
          >
            <Text style={{ fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: on ? colors.primaryText : colors.text }}>{pill.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
