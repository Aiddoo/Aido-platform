import { z } from 'zod';

import { nullableDatetimeSchema } from '../../common/datetime.js';
import { nudgeReplyKindSchema } from './nudge.constants.js';
import { nudgeSchema, nudgeSenderSchema, nudgeTodoSchema } from './nudge.response.js';

export const nudgeInteractionAvailabilityResponseSchema = z.object({
  enabled: z.boolean().describe('콕 주고받기 기능 사용 가능 여부'),
});

export type NudgeInteractionAvailabilityResponse = z.infer<
  typeof nudgeInteractionAvailabilityResponseSchema
>;

export const nudgeInteractionResponseSchema = nudgeSchema.extend({
  sender: nudgeSenderSchema.describe('콕을 보낸 친구'),
  receiver: nudgeSenderSchema.describe('콕을 받은 친구'),
  todo: nudgeTodoSchema
    .nullable()
    .describe('접근할 수 있는 대상 할 일 (비공개 등 접근 불가 시 null)'),
  replyKind: nudgeReplyKindSchema.nullable().describe('선택한 답장 (아직 답하지 않았으면 null)'),
  repliedAt: nullableDatetimeSchema.describe('첫 답장 시각'),
  replyUpdatedAt: nullableDatetimeSchema.describe('마지막 답장 변경 시각'),
  thankedAt: nullableDatetimeSchema.describe('감사를 전한 시각'),
  isAvailable: z.boolean().describe('현재 친구 관계와 공개 할 일이 유지되는지 여부'),
});

export type NudgeInteractionResponse = z.infer<typeof nudgeInteractionResponseSchema>;

export const nudgeInteractionsResponseSchema = z.object({
  items: z.array(nudgeInteractionResponseSchema).describe('주고받은 콕 목록'),
  pagination: z
    .object({
      nextCursor: z.number().int().positive().nullable().describe('다음 페이지 커서'),
      hasNext: z.boolean().describe('다음 페이지 존재 여부'),
      size: z.number().int().positive().describe('요청한 페이지 크기'),
    })
    .describe('콕 목록 커서 페이지네이션'),
});

export type NudgeInteractionsResponse = z.infer<typeof nudgeInteractionsResponseSchema>;

export const nudgeThanksPreviewResponseSchema = z.object({
  todoId: z.number().int().positive().describe('완료한 할 일 ID'),
  throughNudgeId: z.number().int().positive().nullable().describe('미리보기 시점의 마지막 콕 ID'),
  recipients: z
    .array(nudgeSenderSchema)
    .describe('이번에 감사를 받을 친구 (중복과 이미 감사한 친구 제외)'),
  totalRecipients: z.number().int().nonnegative().optional().describe('미리보기 전체 친구 수'),
  nextCursor: z.number().int().positive().nullable().optional().describe('다음 페이지 커서'),
  hasNext: z.boolean().optional().describe('다음 페이지 존재 여부'),
});

export type NudgeThanksPreviewResponse = z.infer<typeof nudgeThanksPreviewResponseSchema>;

export const sendNudgeThanksResponseSchema = z.object({
  sentCount: z.number().int().nonnegative().describe('이번 요청으로 감사를 전한 친구 수'),
});

export type SendNudgeThanksResponse = z.infer<typeof sendNudgeThanksResponseSchema>;
