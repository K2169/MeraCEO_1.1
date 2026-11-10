import { Animated, Pressable } from 'react-native';

import { Icon } from './icon';
import { useSelectFade } from './use-select-fade';
import { useTheme } from './use-theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

// A rounded pill you can tap. When selected it fades to blue over 200ms and shows a tick.
export function Chip({ label, selected = false, onPress }: ChipProps) {
  const { colors, radius, space } = useTheme();
  // 0 = not selected, 1 = selected. The background and label colours fade between the two.
  const fade = useSelectFade(selected);
  const background = fade.interpolate({ inputRange: [0, 1], outputRange: [colors.chip, colors.primary] });
  const labelColor = fade.interpolate({ inputRange: [0, 1], outputRange: [colors.text, colors.primaryText] });

  return (
    <Pressable accessibilityRole={onPress ? 'button' : 'text'} accessibilityState={{ selected }} disabled={!onPress} onPress={onPress}>
      <Animated.View
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          paddingHorizontal: space.md,
          borderRadius: radius.pill,
          backgroundColor: background,
        }}
      >
        {selected ? <Icon name="checkmark" size={14} color={colors.primaryText} /> : null}
        <Animated.Text style={{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: labelColor }}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}
