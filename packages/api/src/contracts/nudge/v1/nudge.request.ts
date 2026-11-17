import { z } from "zod";

import { entityIdSchemaWithMessage } from "../../../common/entity-id.js";
import { NUDGE_LIMITS, REMIND_NUDGE_LIMITS } from "../../../vocabulary/nudge.constants.js";
import { nudgeReplyKindSchema } from "./nudge.common.js";

export const createNudgeSchema = z.object({
  receiverId: entityIdSchemaWithMessage("유효하지 않은 사용자 ID입니다").meta({
    description: "받을 사용자 ID (예: clz7x5p8k0001qz0z8z8z8z8z)",
  }),
  todoId: z
    .int()
    .positive("유효하지 않은 Todo ID입니다")
    .meta({ description: "대상 할 일 ID (양의 정수, 예: 1)" }),
  message: z
    .string()
    .max(
      NUDGE_LIMITS.MAX_MESSAGE_LENGTH,
      `메시지는 ${NUDGE_LIMITS.MAX_MESSAGE_LENGTH}자 이내여야 합니다`,
    )
    .optional()
    .meta({ description: `응원 메시지 (선택, 최대 ${NUDGE_LIMITS.MAX_MESSAGE_LENGTH}자)` }),
});

export const getNudgesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, "최소 1개 이상 조회해야 합니다")
    .max(50, "최대 50개까지 조회 가능합니다")
    .default(20)
    .meta({ description: "조회할 개수 (1-50, 기본값: 20)" }),
  cursor: z.coerce
    .number()
    .int()
    .nonnegative("유효하지 않은 커서입니다")
    .optional()
    .meta({ description: "페이지네이션 커서 (0 이상의 정수)" }),
});

export const createRemindNudgeSchema = z.object({
  receiverId: entityIdSchemaWithMessage("유효하지 않은 사용자 ID입니다").meta({
    description: "받을 사용자 ID",
  }),
  message: z
    .string()
    .max(
      REMIND_NUDGE_LIMITS.MAX_MESSAGE_LENGTH,
      `메시지는 ${REMIND_NUDGE_LIMITS.MAX_MESSAGE_LENGTH}자 이내여야 합니다`,
    )
    .optional()
    .meta({ description: `독촉 메시지 (선택, 최대 ${REMIND_NUDGE_LIMITS.MAX_MESSAGE_LENGTH}자)` }),
});

export const nudgeIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 콕 찌름 ID입니다")
    .meta({ description: "콕 찌름 고유 ID (양의 정수, 예: 1)" }),
});

export const getNudgeInteractionsQuerySchema = getNudgesQuerySchema.extend({
  direction: z
    .enum(["received", "sent"])
    .default("received")
    .meta({ description: "콕을 주고받은 방향" }),
});

export type GetNudgeInteractionsQuery = z.infer<typeof getNudgeInteractionsQuerySchema>;

export const getNudgeThanksPreviewQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .meta({ description: "미리보기 페이지 크기" }),
    cursor: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .meta({ description: "이전 페이지의 마지막 콕 ID" }),
    throughNudgeId: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .meta({ description: "첫 미리보기 시점의 마지막 콕 ID" }),
  })
  .refine(
    (query) => query.cursor == null || (query.limit != null && query.throughNudgeId != null),
    {
      error: "다음 페이지 조회에는 페이지 크기와 미리보기 시점의 콕 ID가 필요합니다",
      path: ["cursor"],
    },
  );

export type GetNudgeThanksPreviewQuery = z.infer<typeof getNudgeThanksPreviewQuerySchema>;

export const replyToNudgeSchema = z.object({
  replyKind: nudgeReplyKindSchema.meta({ description: "콕에 대한 답장 종류" }),
});

export const sendNudgeThanksSchema = z.object({
  throughNudgeId: z
    .int()
    .positive("유효하지 않은 콕 ID입니다")
    .meta({ description: "미리보기 시점의 마지막 콕 ID" }),
});

export const nudgeTodoIdParamSchema = z.object({
  todoId: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 할 일 ID입니다")
    .meta({ description: "감사를 전할 할 일 ID" }),
});
