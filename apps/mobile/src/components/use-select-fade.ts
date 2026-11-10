import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { useReduceMotion } from './use-reduce-motion';

// How long the unselected <-> selected colour change takes, in milliseconds.
export const SELECT_FADE_MS = 200;

// Returns a value that eases from 0 (not selected) to 1 (selected) over 200ms, and back again.
// Components turn it into colours with value.interpolate(...). With "reduce motion" on, it jumps.
// Colours cannot use the native driver, so this runs on the JS side. That is fine for short fades.
export function useSelectFade(selected: boolean): Animated.Value {
  const value = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const reduce = useReduceMotion();

  // Animate whenever the selected state changes.
  useEffect(() => {
    Animated.timing(value, { toValue: selected ? 1 : 0, duration: reduce ? 0 : SELECT_FADE_MS, useNativeDriver: false }).start();
  }, [selected, reduce, value]);

  return value;
}
