import { Animated, Pressable } from 'react-native';

import { Icon } from './icon';
import { useSelectFade } from './use-select-fade';
import { useTheme } from './use-theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

// A rounded pill you can tap. Unselected options stay white with an outline; selected options fade to blue and show a tick.
export function Chip({ label, selected = false, disabled = false, onPress }: ChipProps) {
  const { colors, radius, space } = useTheme();
  // 0 = not selected, 1 = selected. The background and label colours fade between the two.
  const fade = useSelectFade(selected);
  const background = fade.interpolate({ inputRange: [0, 1], outputRange: [disabled ? colors.disabledFace : colors.surface, colors.primary] });
  const labelColor = fade.interpolate({ inputRange: [0, 1], outputRange: [disabled ? colors.disabledText : colors.text, colors.primaryText] });

  return (
    <Pressable accessibilityRole={onPress ? 'button' : 'text'} accessibilityState={{ selected, disabled }} disabled={!onPress || disabled} onPress={onPress}>
      <Animated.View
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          paddingHorizontal: space.md,
          borderRadius: radius.pill,
          backgroundColor: background,
          borderWidth: selected || disabled ? 0 : 1,
          borderColor: colors.border,
        }}
      >
        {selected ? <Icon name="checkmark" size={14} color={colors.primaryText} /> : null}
        <Animated.Text style={{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: labelColor }}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}
