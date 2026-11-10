import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from './use-theme';

// A flat, rounded box that groups related content. No shadow; tint gives a coloured card (blue or green).
export function Card({ children, tint }: { children: ReactNode; tint?: 'blue' | 'green' }) {
  const { colors, radius, space } = useTheme();
  const background = tint === 'blue' ? colors.blueSoft : tint === 'green' ? colors.greenSoft : colors.surface;
  return (
    <View
      style={{
        backgroundColor: background,
        borderRadius: radius.lg,
        // Plain white cards get a thin outline so they stay defined on the pale page background.
        borderWidth: tint ? 0 : 1,
        borderColor: colors.border,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      {children}
    </View>
  );
}
