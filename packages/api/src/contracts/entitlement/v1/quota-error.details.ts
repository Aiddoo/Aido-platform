import { z } from "zod";

import { featureQuotaSchema } from "./entitlement.response.js";

/** 사용 횟수를 차감하지 않은 오류. 앱은 "횟수는 차감되지 않았어요"를 함께 보여 준다. */
export const notChargedErrorDetailsSchema = z
  .object({
    charged: z.literal(false).describe("이 요청으로 사용 횟수가 차감되지 않았는지 (항상 false)"),
  })
  .describe("횟수를 차감하지 않은 오류 상세");

/** 한도 초과·처리 중 충돌처럼 예약 단계에서 막힌 오류. 서버가 계산한 현재 한도를 함께 준다. */
export const quotaErrorDetailsSchema = notChargedErrorDetailsSchema
  .extend({ featureQuota: featureQuotaSchema })
  .describe("횟수 한도 오류 상세 (차감 없음 + 현재 한도)");
