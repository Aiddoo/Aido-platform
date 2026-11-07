import type { z } from 'zod';

/** 저장소에서 읽은 JSON 문자열을 스키마로 검증한다. 값이 없거나 JSON이 아니거나 스키마와 다르면 null이다 */
export function parseStoredJson<TSchema extends z.ZodType>(
  raw: string | null | undefined,
  schema: TSchema,
): z.output<TSchema> | null {
  if (raw == null) {
    return null;
  }

  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
