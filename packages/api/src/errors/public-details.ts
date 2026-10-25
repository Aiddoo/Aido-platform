import { z } from "zod";

import { ErrorCode, type ErrorCodeType } from "./errors.js";

/** 친구 한도 초과(FOLLOW_0909)일 때 앱이 한도 안내에 쓰는 값 */
export const friendLimitErrorDetailsSchema = z
  .object({
    current: z.number().int().nonnegative().describe("현재 친구 수"),
    limit: z
      .number()
      .int()
      .positive()
      .describe("현재 친구 한도 (초대 보상 친구 자리 포함, 양의 정수)"),
  })
  .describe("친구 한도 초과 상세");

export type FriendLimitErrorDetails = z.infer<typeof friendLimitErrorDetailsSchema>;

// 운영 응답에는 여기 등록한 코드의 검증된 필드만 싣고 나머지 details는 숨긴다
const PUBLIC_ERROR_DETAILS: Partial<Record<ErrorCodeType, z.ZodType>> = {
  [ErrorCode.FOLLOW_0909]: friendLimitErrorDetailsSchema,
};

/** 공개 상세가 정해진 코드면 그 스키마로 거른 값을, 아니면 undefined를 반환한다. */
export function toPublicErrorDetails(code: ErrorCodeType, details: unknown): unknown {
  const schema = PUBLIC_ERROR_DETAILS[code];
  if (schema === undefined) return undefined;
  const parsed = schema.safeParse(details);
  return parsed.success ? parsed.data : undefined;
}
