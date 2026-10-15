import { useEffect, useState } from 'react';

/**
 * Debounces a rapidly changing value (search boxes, resize handlers). Keeps the
 * raw value available so the input stays responsive while the query waits.
 */
export const useDebounced = <T>(value: T, delayMs = 300): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
