import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

/** z.encode는 undefined 키를 빼지만 setParams는 얕은 병합이라, 빠진 키는 URL에서 지워지지 않는다 */
function encodeRouteParams<TSchema extends z.ZodObject>(
  schema: TSchema,
  next: Partial<z.output<TSchema>>,
) {
  const encoded = new Map(Object.entries(z.encode(schema.partial(), next)));

  return Object.fromEntries(
    Object.keys(next).map((key) => {
      const value = encoded.get(key);
      return [key, typeof value === 'string' ? value : undefined] as const;
    }),
  );
}

/** 쓰는 필드의 URL 형식은 문자열이고 `.transform` 대신 `z.codec`이어야 한다 */
export function useRouteParams<TSchema extends z.ZodObject>(schema: TSchema) {
  const params = schema.parse(useLocalSearchParams());
  const setParams = useCallback(
    (next: Partial<z.output<TSchema>>) => router.setParams(encodeRouteParams(schema, next)),
    [schema],
  );

  return [params, setParams] as const;
}
