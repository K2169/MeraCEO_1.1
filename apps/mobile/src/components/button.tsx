import { Pressable, Text, View } from 'react-native';

import { Icon } from './icon';
import { PressSurface } from './press-surface';
import { useTheme } from './use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  small?: boolean; // a shorter button for use inside cards
  arrow?: boolean; // show a forward arrow after the label (used on Next buttons)
}

// Flat button. Primary is solid blue, secondary is white with a thin outline, danger is solid red and
// ghost is plain text. Pressing dims it a little (see press-surface.tsx).
export function Button({ label, onPress, variant = 'primary', disabled = false, arrow = false, small = false }: ButtonProps) {
  const { colors, radius } = useTheme();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const textColor = disabled ? colors.disabledText : isDanger ? colors.solidText : isPrimary ? colors.primaryText : colors.primary;
  const labelStyle = { color: textColor, fontSize: small ? 14 : 16, fontFamily: 'DMSans_600SemiBold' as const };

  if (variant === 'ghost') {
    return (
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={labelStyle}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <PressSurface
      face={disabled ? colors.disabledFace : isDanger ? colors.danger : isPrimary ? colors.primary : colors.surface}
      borderColor={variant === 'secondary' && !disabled ? colors.border : undefined}
      radius={radius.md}
      onPress={onPress}
      disabled={disabled}
      style={{ minHeight: small ? 40 : 52, paddingHorizontal: small ? 16 : 20, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={labelStyle}>{label}</Text>
        {arrow ? <Icon name="arrow-forward" size={20} color={textColor} /> : null}
      </View>
    </PressSurface>
  );
}
