import { useEffect, useState } from 'react';

const DEBOUNCE_DELAY_MS = 300;

export function useDebouncedValue<T>(value: T): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, DEBOUNCE_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [value]);

  return debounced;
}
