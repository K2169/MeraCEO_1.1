import { useEffect, useState } from 'react';

// Returns `value` after it has stopped changing for `ms` milliseconds. Used so a search does not hit the
// server on every key press.
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
