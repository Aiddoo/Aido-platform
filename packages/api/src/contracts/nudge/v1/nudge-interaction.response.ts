import { z } from "zod";

import { nullableDatetimeSchema } from "../../../common/datetime.js";
import { nudgeReplyKindSchema } from "./nudge.common.js";
import { nudgeSchema, nudgeSenderSchema, nudgeTodoSchema } from "./nudge.response.js";

export const nudgeInteractionAvailabilityResponseSchema = z.object({
  enabled: z.boolean().meta({ description: "콕 주고받기 기능 사용 가능 여부" }),
});

export type NudgeInteractionAvailabilityResponse = z.infer<
  typeof nudgeInteractionAvailabilityResponseSchema
>;

export const nudgeInteractionResponseSchema = nudgeSchema.extend({
  sender: nudgeSenderSchema.meta({ description: "콕을 보낸 친구" }),
  receiver: nudgeSenderSchema.meta({ description: "콕을 받은 친구" }),
  todo: nudgeTodoSchema
    .nullable()
    .meta({ description: "접근할 수 있는 대상 할 일 (비공개 등 접근 불가 시 null)" }),
  replyKind: nudgeReplyKindSchema
    .nullable()
    .meta({ description: "선택한 답장 (아직 답하지 않았으면 null)" }),
  repliedAt: nullableDatetimeSchema.meta({ description: "첫 답장 시각" }),
  replyUpdatedAt: nullableDatetimeSchema.meta({ description: "마지막 답장 변경 시각" }),
  thankedAt: nullableDatetimeSchema.meta({ description: "감사를 전한 시각" }),
  isAvailable: z.boolean().meta({ description: "현재 친구 관계와 공개 할 일이 유지되는지 여부" }),
});

export type NudgeInteractionResponse = z.infer<typeof nudgeInteractionResponseSchema>;

export const nudgeInteractionsResponseSchema = z.object({
  items: z.array(nudgeInteractionResponseSchema).meta({ description: "주고받은 콕 목록" }),
  pagination: z
    .object({
      nextCursor: z.int().positive().nullable().meta({ description: "다음 페이지 커서" }),
      hasNext: z.boolean().meta({ description: "다음 페이지 존재 여부" }),
      size: z.int().positive().meta({ description: "요청한 페이지 크기" }),
    })
    .meta({ description: "콕 목록 커서 페이지네이션" }),
});

export type NudgeInteractionsResponse = z.infer<typeof nudgeInteractionsResponseSchema>;

export const nudgeThanksPreviewResponseSchema = z.object({
  todoId: z.int().positive().meta({ description: "완료한 할 일 ID" }),
  throughNudgeId: z
    .int()
    .positive()
    .nullable()
    .meta({ description: "미리보기 시점의 마지막 콕 ID" }),
  recipients: z
    .array(nudgeSenderSchema)
    .meta({ description: "이번에 감사를 받을 친구 (중복과 이미 감사한 친구 제외)" }),
  totalRecipients: z.int().nonnegative().optional().meta({ description: "미리보기 전체 친구 수" }),
  nextCursor: z.int().positive().nullable().optional().meta({ description: "다음 페이지 커서" }),
  hasNext: z.boolean().optional().meta({ description: "다음 페이지 존재 여부" }),
  thankedRecipientCount: z
    .int()
    .nonnegative()
    .optional()
    .meta({ description: "이 할 일에서 이미 감사를 전한 친구 수" }),
  lastThankedAt: nullableDatetimeSchema
    .optional()
    .meta({ description: "마지막으로 감사를 전한 시각 (전한 적 없으면 null)" }),
});

export type NudgeThanksPreviewResponse = z.infer<typeof nudgeThanksPreviewResponseSchema>;

export const sendNudgeThanksResponseSchema = z.object({
  sentCount: z.int().nonnegative().meta({ description: "이번 요청으로 감사를 전한 친구 수" }),
});

export type SendNudgeThanksResponse = z.infer<typeof sendNudgeThanksResponseSchema>;
