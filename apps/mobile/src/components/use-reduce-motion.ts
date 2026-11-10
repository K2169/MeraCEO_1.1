import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// True when the person has turned on "reduce motion" in their phone settings.
// Animations check this and skip the movement when it is on.
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  // Read the setting once, then keep it updated if the person changes it.
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduce(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}
