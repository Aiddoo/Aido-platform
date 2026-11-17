import { z } from "zod";

import { datetimeSchema } from "../../../common/datetime.js";

export const aiUsageDataSchema = z.object({
  used: z.int().nonnegative().meta({ description: "현재까지 사용한 AI 요청 횟수 (0 이상)" }),
  limit: z
    .int()
    .positive()
    .nullable()
    .meta({ description: "월간 최대 AI 요청 횟수 (null = 무제한, KST 매월 1일 00:00 리셋)" }),
  resetsAt: datetimeSchema.meta({
    description: "사용량 리셋 시각 (ISO 8601 UTC, 예: 2026-01-18T00:00:00.000Z)",
  }),
});

export const tokenUsageSchema = z.object({
  input: z.int().nonnegative().meta({ description: "입력 토큰 수 (0 이상)" }),
  output: z.int().nonnegative().meta({ description: "출력 토큰 수 (0 이상)" }),
});

export const aiUsageResponseSchema = z.object({
  success: z.literal(true).meta({ description: "조회 성공 여부 (항상 true)" }),
  data: aiUsageDataSchema.meta({ description: "AI 사용량 정보" }),
});
