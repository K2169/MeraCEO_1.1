import { Image, Text, View } from 'react-native';

import { PressSurface } from './press-surface';
import { useTheme } from './use-theme';

// "Continue with Google" button, styled the way Google asks: a light button with the
// four-colour G on the left and dark text. Flat, with a thin outline.
export function GoogleButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors, radius, space } = useTheme();

  return (
    <PressSurface
      face={colors.surface}
      borderColor={colors.border}
      radius={radius.pill}
      onPress={onPress}
      disabled={disabled}
      style={{ minHeight: 48, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Image source={require('../../assets/images/google-g.png')} style={{ width: 22, height: 22 }} />
        <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'DMSans_600SemiBold' }}>{label}</Text>
      </View>
    </PressSurface>
  );
}
