import { Animated, Pressable, Text, View } from 'react-native';

import { Icon } from './icon';
import { useSelectFade } from './use-select-fade';
import { useTheme } from './use-theme';

interface CheckboxProps {
  label: string; // the main text (or the title, when a description is given)
  description?: string; // one line of explanation under the title
  badge?: string; // small tag at the right of the title, such as "Required"
  checked: boolean;
  onChange: (v: boolean) => void;
}

// A whole-row tap target with a tick box. Starts unticked; the screen decides what a tick means.
// A ticked row fades to soft green with a green edge over 200ms, and the tick fades in with it.
export function Checkbox({ label, description, badge, checked, onChange }: CheckboxProps) {
  const { colors, radius, space, type } = useTheme();
  // 0 = not ticked, 1 = ticked. The row, edge, box and tick all fade together.
  const fade = useSelectFade(checked);
  const rowColor = fade.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, colors.greenSoft] });
  // The unticked edge matches the row colour, so it is invisible until the green edge fades in.
  const rowEdge = fade.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, colors.accent] });
  const boxEdge = fade.interpolate({ inputRange: [0, 1], outputRange: [colors.muted, colors.accent] });
  const boxFill = fade.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', colors.accent] });
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={() => onChange(!checked)}
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: rowEdge,
          backgroundColor: rowColor,
        }}
      >
      <Animated.View
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: boxEdge,
          backgroundColor: boxFill,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* The tick is always there, and fades in with the box fill, so nothing shifts */}
        <Animated.View style={{ opacity: fade }}>
          <Icon name="checkmark" size={18} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={[description ? type.heading : type.body, description ? { fontSize: 18, lineHeight: 24 } : null, { color: colors.text, flexShrink: 1 }]}>{label}</Text>
          {badge ? (
            <View style={{ backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 }}>
              <Text style={[type.caption, { color: colors.primary, fontSize: 12, lineHeight: 16 }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {description ? <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_500Medium' }]}>{description}</Text> : null}
      </View>
      </Animated.View>
    </Pressable>
  );
}
