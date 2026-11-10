import { useState } from 'react';
import { Animated, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from './icon';
import { BottomSheet } from './bottom-sheet';
import { SELECT_FADE_MS, useSelectFade } from './use-select-fade';
import { useTheme } from './use-theme';

// One row in the picker list. The label colour and the tick fade when the row becomes selected.
function PickerRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors, space } = useTheme();
  const fade = useSelectFade(selected);
  const textColor = fade.interpolate({ inputRange: [0, 1], outputRange: [colors.text, colors.primary] });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md + 2 }}
    >
      <Animated.Text style={{ fontSize: 16, fontFamily: selected ? 'DMSans_700Bold' : 'DMSans_500Medium', color: textColor }}>{label}</Animated.Text>
      <Animated.View style={{ opacity: fade }}>
        <Icon name="checkmark" size={22} color={colors.primary} />
      </Animated.View>
    </Pressable>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

// A form field that shows the chosen value. Tapping it opens a bottom sheet to pick from,
// so long lists (like industries) do not take up space on the form.
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  searchable = false,
  error,
}: {
  label: string;
  value: T | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder: string;
  searchable?: boolean; // show a search box above long lists (countries, cities)
  error?: string;
}) {
  const { colors, radius, space, type } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chosen = options.find((o) => o.value === value)?.label;
  // With a search box, only options containing the typed text are shown.
  const shown = query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options;

  // Save the pick, let the row finish its fade, then close the sheet.
  function pick(next: T) {
    onChange(next);
    setTimeout(close, SELECT_FADE_MS);
  }

  // Close the sheet and clear the search.
  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.caption, { color: colors.muted }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 52,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Text style={{ fontSize: 16, color: chosen ? colors.text : colors.muted }}>{chosen ?? placeholder}</Text>
        <Icon name="chevron-down" size={20} color={colors.muted} />
      </Pressable>

      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}

      <BottomSheet visible={open} onClose={close} title={label}>
        {searchable ? (
          <TextInput
            accessibilityLabel={label}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            style={{
              fontSize: 17,
              color: colors.text,
              backgroundColor: colors.background,
              borderRadius: radius.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
              minHeight: 48,
              marginBottom: space.sm,
            }}
          />
        ) : null}
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={shown}
          keyExtractor={(o) => o.value}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
          renderItem={({ item }) => {
            return <PickerRow label={item.label} selected={item.value === value} onPress={() => pick(item.value)} />;
          }}
        />
      </BottomSheet>
    </View>
  );
}
