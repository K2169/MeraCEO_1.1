import { Pressable, Text, View } from 'react-native';

import { Icon } from './icon';
import { PressSurface } from './press-surface';
import { fontFamily } from './theme';
import { useTheme } from './use-theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  labelPrefix?: string;
  tone?: 'brand' | 'green';
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  small?: boolean; // a shorter button for use inside cards
  minHeight?: number;
  pill?: boolean; // fully rounded ends for welcome actions
  arrow?: boolean; // show a forward arrow after the label (used on Next buttons)
}

// Flat button. Primary is solid blue, secondary is white with a thin outline, danger is solid red and
// ghost is plain text. Pressing dims it a little (see press-surface.tsx).
export function Button({ label, labelPrefix, tone = 'brand', onPress, variant = 'primary', disabled = false, arrow = false, small = false, pill = false, minHeight }: ButtonProps) {
  const { colors, radius } = useTheme();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const actionFill = tone === 'green' ? colors.solidGreen : colors.primary;
  const actionText = tone === 'green' ? colors.solidText : colors.primaryText;
  const actionInk = tone === 'green' ? colors.accentText : colors.primary;
  const textColor = disabled ? colors.disabledText : isDanger ? colors.solidText : isPrimary ? actionText : actionInk;
  const labelStyle = { color: textColor, fontSize: small ? 14 : 16, fontFamily: fontFamily.semibold };

  if (variant === 'ghost') {
    return (
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={labelStyle}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <PressSurface
      face={disabled ? colors.disabledFace : isDanger ? colors.danger : isPrimary ? actionFill : colors.surface}
      borderColor={disabled ? undefined : variant === 'outline' ? actionInk : variant === 'secondary' ? colors.border : undefined}
      radius={pill ? radius.pill : radius.md}
      onPress={onPress}
      disabled={disabled}
      style={{ minHeight: minHeight ?? (small ? 40 : 52), paddingHorizontal: small ? 16 : 20, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[labelStyle, { flexShrink: 1, textAlign: 'center' }]}>
          {labelPrefix ? (
            <Text style={{ fontFamily: fontFamily.medium, color: variant === 'outline' && !disabled ? colors.text : textColor }}>
              {labelPrefix}{' '}
            </Text>
          ) : null}
          {label}
        </Text>
        {arrow ? <Icon name="arrow-forward" size={20} color={textColor} /> : null}
      </View>
    </PressSurface>
  );
}
