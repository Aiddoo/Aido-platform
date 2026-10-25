import { useState } from 'react';

/** 값이 사라져도 마지막으로 있던 값을 돌려준다. 삭제 직후 닫히는 시트가 내용을 유지할 때 쓴다. */
export function useRetainedValue<T>(value: T | null | undefined): T | null {
  const [retained, setRetained] = useState<T | null>(value ?? null);

  if (value != null && value !== retained) {
    setRetained(value);
  }

  return value ?? retained;
}
