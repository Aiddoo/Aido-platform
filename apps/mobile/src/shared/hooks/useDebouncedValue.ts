import { useEffect, useState } from 'react';

const DEFAULT_DEBOUNCE_DELAY_MS = 300;

/**
 * 값 변경을 지정한 지연만큼 디바운스한다.
 * 검색 입력처럼 빠르게 바뀌는 값으로 쿼리를 구동할 때 마지막 값만 반영한다.
 */
export const useDebouncedValue = <T>(value: T, delayMs: number = DEFAULT_DEBOUNCE_DELAY_MS): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
};
