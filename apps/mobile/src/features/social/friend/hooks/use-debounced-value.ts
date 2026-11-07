import { useEffect, useState } from 'react';

const DEBOUNCE_DELAY_MS = 300;

/**
 * 값 변경을 잠시 늦춰 디바운스한다.
 * 검색 입력처럼 빠르게 바뀌는 값으로 쿼리를 구동할 때 마지막 값만 반영한다.
 */
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
