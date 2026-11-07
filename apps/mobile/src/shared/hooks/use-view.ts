import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import type { z } from 'zod';

/**
 * 탭·보기처럼 URL 값 하나를 `[view, setView]`로 읽고 쓴다. 없거나 잘못된 값은 스키마의 `.catch` 기본값이다.
 * `schema`는 모듈 상수로 넘긴다. 여러 값을 함께 바꾸면 `useRouteParams`를 쓴다.
 */
export function useView<TSchema extends z.ZodType<string>>(
  key: string,
  schema: z.ZodCatch<TSchema>,
) {
  const view = schema.parse(useLocalSearchParams()[key]);
  const setView = useCallback(
    (next: z.output<TSchema>) => router.setParams({ [key]: next }),
    [key],
  );

  return [view, setView] as const;
}
