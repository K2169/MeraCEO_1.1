import { type ReactNode } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Icon, type IconName } from './icon';
import { useTheme } from './use-theme';

// A titled group of settings rows inside one thin-outlined card, like the settings pages in banking
// and business apps. Rows are separated by hairlines.
export function SettingsGroup({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const { colors, radius, space, type } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      {title ? <Text style={[type.caption, { color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: space.xs }]}>{title}</Text> : null}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>{children}</View>
      {footer ? <Text style={[type.caption, { color: colors.muted, paddingHorizontal: space.xs, fontFamily: 'DMSans_500Medium' }]}>{footer}</Text> : null}
    </View>
  );
}

interface RowProps {
  icon: IconName;
  label: string;
  description?: string;
  onPress?: () => void; // makes the row a button with a chevron
  switchValue?: boolean; // shows an on/off switch instead of a chevron
  onSwitch?: (value: boolean) => void;
  danger?: boolean; // red label for destructive actions
  last?: boolean; // no hairline under the final row
}

// One row: icon, label (and optional description), then a chevron or a switch on the right.
export function SettingsRow({ icon, label, description, onPress, switchValue, onSwitch, danger = false, last = false }: RowProps) {
  const { colors, space, type } = useTheme();
  const tint = danger ? colors.danger : colors.text;
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md - 2,
        minHeight: 56,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      {/* The icon sits in a small soft square, so every row lines up the same way */}
      <View style={{ width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? colors.dangerSoft : colors.background }}>
        <Icon name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: danger ? colors.danger : colors.text, fontFamily: 'DMSans_500Medium' }]}>{label}</Text>
        {description ? <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_400Regular' }]}>{description}</Text> : null}
      </View>
      {onSwitch ? (
        <Switch value={!!switchValue} onValueChange={onSwitch} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#FFFFFF" />
      ) : onPress ? (
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      ) : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}
