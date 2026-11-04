import { z } from "zod";

import { featureQuotaSchema } from "../../entitlement/v1/entitlement.response.js";
import { actionPlanMetaSchema, actionPlanSchema } from "./action-plan.common.js";

export const quickPlanResponseSchema = z.object({
  plan: actionPlanSchema,
  meta: actionPlanMetaSchema,
  featureQuota: featureQuotaSchema
    .nullable()
    .describe("이 요청을 반영한 AI_PARSE 한도·사용량. 결과는 주되 한도를 읽지 못했으면 null"),
  charged: z
    .boolean()
    .describe(
      "이 요청으로 횟수를 썼는지. 할 일을 찾지 못해 환불했으면 false다. 환불을 마치지 못했으면 true다",
    ),
});

export type QuickPlanResponse = z.infer<typeof quickPlanResponseSchema>;
