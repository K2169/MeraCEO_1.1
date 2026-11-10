import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { useReduceMotion } from './use-reduce-motion';
import { useTheme } from './use-theme';

// Progress bar made of pills. Each pill fills with blue, one after another, when the step changes.
// The fill grows with scaleX on the native driver, so it stays smooth.
export function StepIndicator({ current, total }: { current: number; total: number }) {
  const { colors, space } = useTheme();
  const fills = useRef(Array.from({ length: total }, () => new Animated.Value(0))).current;
  const reduce = useReduceMotion();

  // Animate each pill to full or empty depending on whether its step is done.
  useEffect(() => {
    fills.forEach((fill, i) => {
      Animated.timing(fill, { toValue: i < current ? 1 : 0, duration: reduce ? 0 : 300, useNativeDriver: true }).start();
    });
  }, [current, fills, reduce]);

  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: current }} style={{ flexDirection: 'row', gap: space.sm }}>
      {fills.map((fill, i) => (
        <View key={i} style={{ flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.chip, overflow: 'hidden' }}>
          <Animated.View
            style={{
              ...{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
              backgroundColor: colors.primary,
              transformOrigin: 'left',
              transform: [{ scaleX: fill }],
            }}
          />
        </View>
      ))}
    </View>
  );
}
