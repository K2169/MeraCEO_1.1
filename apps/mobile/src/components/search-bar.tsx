import { Pressable, TextInput, View } from 'react-native';

import { Icon } from './icon';
import { useTheme } from './use-theme';

// A search box: magnifier on the left, a clear button on the right once something is typed.
export function SearchBar({ value, onChangeText, hint }: { value: string; onChangeText: (v: string) => void; hint: string }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 48,
        paddingHorizontal: space.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: colors.border,
      }}
    >
      <Icon name="search" size={20} color={colors.muted} />
      <TextInput
        accessibilityLabel={hint}
        value={value}
        onChangeText={onChangeText}
        placeholder={hint}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCorrect={false}
        style={{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: space.sm }}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => onChangeText('')}>
          <Icon name="close-circle" size={20} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
