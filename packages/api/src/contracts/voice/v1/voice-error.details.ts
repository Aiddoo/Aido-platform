import { z } from "zod";

import { ACTION_PLAN_REJECTION_REASONS } from "../../../vocabulary/voice.constants.js";
import { quotaErrorDetailsSchema } from "../../entitlement/v1/quota-error.details.js";

/** AI_1312 공개 상세 */
export const voiceNoteTooLongErrorDetailsSchema = quotaErrorDetailsSchema
  .extend({
    characterCount: z.int().nonnegative().meta({ description: "보낸 글자 수" }),
    maxCharacters: z
      .int()
      .positive()
      .meta({ description: "현재 등급에서 한 번에 보낼 수 있는 글자 수" }),
  })
  .meta({ description: "녹음 길이 초과 상세 (차감 없음 + 글자 수 + 현재 한도)" });

/** AI_1315 공개 상세 */
export const actionPlanRejectedErrorDetailsSchema = z
  .object({
    reason: z
      .enum(ACTION_PLAN_REJECTION_REASONS)
      .meta({ description: "계획을 저장하지 않은 이유" }),
    categoryIds: z
      .array(z.int().positive())
      .optional()
      .meta({ description: "CATEGORY_NOT_OWNED일 때 내 카테고리가 아닌 id" }),
  })
  .meta({ description: "계획 저장 거절 상세" });
