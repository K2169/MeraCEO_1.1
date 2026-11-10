import { type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

interface PressSurfaceProps {
  face: string; // background colour of the button or card
  radius: number; // corner radius
  borderColor?: string; // optional thin outline (used by secondary buttons and plain cards)
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>; // size and padding
  children: ReactNode;
}

// The app's one tappable surface: a flat coloured shape. While a finger is down it dims slightly,
// which is all the feedback a calm, professional screen needs.
export function PressSurface({ face, radius, borderColor, onPress, disabled = false, style, children }: PressSurfaceProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: face,
          borderRadius: radius,
          borderWidth: borderColor ? 1.5 : 0,
          borderColor,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
