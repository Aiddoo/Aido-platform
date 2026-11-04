import { z } from "zod";

import { featureQuotaSchema } from "../../entitlement/v1/entitlement.response.js";
import { actionPlanMetaSchema, actionPlanSchema } from "./action-plan.common.js";

export const quickPlanResponseSchema = z.object({
  plan: actionPlanSchema,
  meta: actionPlanMetaSchema,
  featureQuota: featureQuotaSchema.describe("이 요청을 반영한 AI_PARSE 한도·사용량"),
  charged: z.boolean().describe("이 요청으로 횟수를 썼는지. 할 일을 찾지 못했으면 환불해 false다"),
});

export type QuickPlanResponse = z.infer<typeof quickPlanResponseSchema>;
