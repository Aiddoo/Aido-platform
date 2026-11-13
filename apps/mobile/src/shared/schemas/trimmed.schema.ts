import { z } from 'zod';

/** 앞뒤 공백을 지운 뒤 계약 스키마로 검사한다. 공백만 있는 값은 빈 값이다 */
export function trimmed<TSchema extends z.ZodType<string, string>>(schema: TSchema) {
  return z.string().trim().pipe(schema);
}
