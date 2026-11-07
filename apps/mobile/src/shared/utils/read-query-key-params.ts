import { last } from 'es-toolkit';
import type { z } from 'zod';

/** 쿼리 키의 인자는 객체 하나이고 항상 마지막에 둔다. 자리를 세지 않고 이 규칙으로 읽는다 */
export function readQueryKeyParams<TParams>(
  queryKey: readonly unknown[],
  schema: z.ZodType<TParams>,
): TParams | null {
  const parsed = schema.safeParse(last(queryKey));
  return parsed.success ? parsed.data : null;
}
