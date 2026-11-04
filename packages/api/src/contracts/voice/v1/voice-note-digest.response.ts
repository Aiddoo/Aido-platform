import { z } from "zod";

import { ACTION_PLAN_LIMITS } from "../../../vocabulary/ai.constants.js";
import { featureQuotaSchema } from "../../entitlement/v1/entitlement.response.js";
import { actionPlanMetaSchema, actionPlanSchema } from "./action-plan.common.js";

export const voiceNoteKeyPointSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(ACTION_PLAN_LIMITS.DIGEST_KEY_POINT_MAX_LENGTH)
    .describe("핵심 내용 한 문장 (앱 언어)"),
  startMs: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe("이 내용을 말한 시각 (앱이 보낸 segments의 값). 찾지 못했으면 null"),
});

export type VoiceNoteKeyPoint = z.infer<typeof voiceNoteKeyPointSchema>;

export const voiceNoteDigestResponseSchema = z.object({
  title: z
    .string()
    .max(ACTION_PLAN_LIMITS.DIGEST_TITLE_MAX_LENGTH)
    .describe("녹음 제목 (앱 언어). 비어 있으면 앱이 기본 제목을 쓴다"),
  summary: z.string().max(ACTION_PLAN_LIMITS.DIGEST_SUMMARY_MAX_LENGTH).describe("요약 (앱 언어)"),
  keyPoints: z
    .array(voiceNoteKeyPointSchema)
    .max(ACTION_PLAN_LIMITS.DIGEST_MAX_KEY_POINTS)
    .describe(`핵심 내용 (최대 ${ACTION_PLAN_LIMITS.DIGEST_MAX_KEY_POINTS}개)`),
  plan: actionPlanSchema,
  meta: actionPlanMetaSchema,
  featureQuota: featureQuotaSchema.describe("이 요청을 반영한 VOICE_NOTE 한도·사용량"),
  charged: z.boolean().describe("이 요청으로 횟수를 썼는지. 할 일을 찾지 못했으면 환불해 false다"),
});

export type VoiceNoteDigestResponse = z.infer<typeof voiceNoteDigestResponseSchema>;
