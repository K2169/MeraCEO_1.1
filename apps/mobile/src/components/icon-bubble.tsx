import { View } from 'react-native';

import { Icon, type IconName } from './icon';
import { useTheme } from './use-theme';

// A round coloured badge with a line icon in it. Used as the big picture on intro, role and empty screens.
export function IconBubble({ icon, tint = 'blue', size = 96 }: { icon: IconName; tint?: 'blue' | 'green'; size?: number }) {
  const { colors } = useTheme();
  const iconColor = tint === 'green' ? colors.accentText : colors.primary;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tint === 'green' ? colors.greenSoft : colors.blueSoft,
      }}
    >
      <Icon name={icon} size={size * 0.44} color={iconColor} />
    </View>
  );
}
