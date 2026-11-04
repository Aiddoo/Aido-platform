import { z } from "zod";

import {
  notChargedErrorDetailsSchema,
  quotaErrorDetailsSchema,
} from "../contracts/entitlement/v1/quota-error.details.js";
import {
  todoSeriesEndedErrorDetailsSchema,
  todoSeriesLimitErrorDetailsSchema,
  todoSeriesNoDatesErrorDetailsSchema,
  todoSeriesNotFoundErrorDetailsSchema,
  todoSeriesRuleErrorDetailsSchema,
  todoSeriesScopeErrorDetailsSchema,
} from "../contracts/todo/v1/todo-series.error-details.js";
import {
  actionPlanRejectedErrorDetailsSchema,
  voiceNoteTooLongErrorDetailsSchema,
} from "../contracts/voice/v1/voice-error.details.js";
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

/**
 * FOLLOW_0909 운영 응답 상세. 출시 앱이 읽는 current·limit을 그대로 두고 다른 한도 오류와 같은
 * charged·featureQuota를 더한다.
 */
export const friendQuotaErrorDetailsSchema = quotaErrorDetailsSchema
  .extend(friendLimitErrorDetailsSchema.shape)
  .describe("친구 한도 초과 상세 (current·limit + 차감 없음 + 현재 한도)");

export type FriendQuotaErrorDetails = z.infer<typeof friendQuotaErrorDetailsSchema>;

// 운영 응답에는 여기 등록한 코드의 검증된 필드만 싣고 나머지 details는 숨긴다
const PUBLIC_ERROR_DETAILS: Partial<Record<ErrorCodeType, z.ZodType>> = {
  [ErrorCode.TODO_0841]: todoSeriesNotFoundErrorDetailsSchema,
  [ErrorCode.TODO_0842]: todoSeriesLimitErrorDetailsSchema,
  [ErrorCode.TODO_0843]: todoSeriesNoDatesErrorDetailsSchema,
  [ErrorCode.TODO_0844]: todoSeriesScopeErrorDetailsSchema,
  [ErrorCode.TODO_0845]: todoSeriesRuleErrorDetailsSchema,
  [ErrorCode.TODO_0846]: todoSeriesEndedErrorDetailsSchema,
  [ErrorCode.TODO_CATEGORY_0857]: quotaErrorDetailsSchema,
  [ErrorCode.FOLLOW_0909]: friendQuotaErrorDetailsSchema,
  [ErrorCode.NUDGE_1101]: quotaErrorDetailsSchema,
  [ErrorCode.CHEER_1201]: quotaErrorDetailsSchema,
  // AI 생성이 끝내 실패해 예약을 환불한 요청
  [ErrorCode.AI_1301]: notChargedErrorDetailsSchema,
  [ErrorCode.AI_1302]: notChargedErrorDetailsSchema,
  [ErrorCode.AI_1310]: notChargedErrorDetailsSchema,
  [ErrorCode.AI_1303]: quotaErrorDetailsSchema,
  [ErrorCode.AI_1313]: quotaErrorDetailsSchema,
  [ErrorCode.AI_1314]: quotaErrorDetailsSchema,
  [ErrorCode.AI_1312]: voiceNoteTooLongErrorDetailsSchema,
  [ErrorCode.AI_1315]: actionPlanRejectedErrorDetailsSchema,
  [ErrorCode.AI_1317]: quotaErrorDetailsSchema,
};

/** 공개 상세가 정해진 코드면 그 스키마로 거른 값을, 아니면 undefined를 반환한다. */
export function toPublicErrorDetails(code: ErrorCodeType, details: unknown): unknown {
  const schema = PUBLIC_ERROR_DETAILS[code];
  if (schema == null) {
    return undefined;
  }
  const parsed = schema.safeParse(details);
  return parsed.success ? parsed.data : undefined;
}
