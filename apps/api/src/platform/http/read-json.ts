import type { z } from "zod";

/**
 * 벤더 HTTP 응답 본문을 호출부 스키마로 검증한다.
 *
 * `Response.json()`은 `unknown`이므로 외부 API 경계에서 형태를 확인한 결과만 돌려준다.
 * 잘못된 JSON은 그대로 던지고, 형태가 다르면 실패 결과를 돌려준다.
 */
export async function readJson<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<z.ZodSafeParseResult<T>> {
  return schema.safeParse(await response.json());
}
