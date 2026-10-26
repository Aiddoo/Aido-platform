import { z } from "zod";

import { nullableDatetimeSchema } from "../../common/datetime.js";
import {
  AI_DATA_SHARING_CONSENT,
  AI_DATA_SHARING_DECISIONS,
} from "../../vocabulary/user-consent.constants.js";

export const aiDataSharingDecisionSchema = z
  .enum(AI_DATA_SHARING_DECISIONS)
  .describe(
    "현재 안내 버전 기준 AI 데이터 처리 동의 상태 (AGREED: 동의 | DECLINED: 거부·철회 | UNDECIDED: 아직 답하지 않았거나 안내 버전이 바뀜)",
  );

const aiDataSharingConsentFields = {
  aiDataSharingDecision: aiDataSharingDecisionSchema.optional(),
  aiDataSharingAgreedAt: nullableDatetimeSchema
    .optional()
    .describe("AI 데이터 처리 동의 시각 (ISO 8601 UTC, 미동의·철회 시 null, 1.13.0+)"),
  aiDataSharingConsentVersion: z
    .string()
    .nullable()
    .optional()
    .describe("마지막으로 답한 AI 데이터 처리 안내 버전 (답한 적 없으면 null, 1.13.0+)"),
};

export const userConsentSchema = z
  .object({
    termsAgreedAt: nullableDatetimeSchema.describe(
      "서비스 이용약관 동의 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z, 미동의 시 null)",
    ),
    privacyAgreedAt: nullableDatetimeSchema.describe(
      "개인정보처리방침 동의 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z, 미동의 시 null)",
    ),
    agreedTermsVersion: z
      .string()
      .nullable()
      .describe("동의한 약관 버전 (예: 1.0.0, 미동의 시 null)"),
    marketingAgreedAt: nullableDatetimeSchema.describe(
      "마케팅 수신 동의 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z, 미동의 시 null)",
    ),
    marketingPushAgreedAt: nullableDatetimeSchema.describe(
      "광고성 앱 푸시 수신 동의 시각 (미동의/철회 시 null)",
    ),
    ...aiDataSharingConsentFields,
  })
  .meta({
    example: {
      termsAgreedAt: "2026-01-17T10:00:00.000Z",
      privacyAgreedAt: "2026-01-17T10:00:00.000Z",
      agreedTermsVersion: "1.0.0",
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
      aiDataSharingDecision: "AGREED",
      aiDataSharingAgreedAt: "2026-10-26T09:00:00.000Z",
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    },
  });

export type UserConsent = z.infer<typeof userConsentSchema>;

export const consentResponseSchema = userConsentSchema.meta({
  example: {
    termsAgreedAt: "2026-01-17T10:00:00.000Z",
    privacyAgreedAt: "2026-01-17T10:00:00.000Z",
    agreedTermsVersion: "1.0.0",
    marketingAgreedAt: null,
    marketingPushAgreedAt: null,
    aiDataSharingDecision: "AGREED",
    aiDataSharingAgreedAt: "2026-10-26T09:00:00.000Z",
    aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
  },
});

export type ConsentResponse = z.infer<typeof consentResponseSchema>;

export const updateMarketingConsentResponseSchema = z
  .object({
    marketingAgreedAt: nullableDatetimeSchema.describe(
      "마케팅 수신 동의 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z, 철회 시 null)",
    ),
  })
  .meta({
    example: {
      marketingAgreedAt: "2026-01-17T10:00:00.000Z",
    },
  });

export type UpdateMarketingConsentResponse = z.infer<typeof updateMarketingConsentResponseSchema>;

export const updateMarketingPushConsentResponseSchema = z
  .object({
    marketingPushAgreedAt: nullableDatetimeSchema.describe(
      "광고성 앱 푸시 수신 동의 시각 (철회 시 null)",
    ),
  })
  .meta({ example: { marketingPushAgreedAt: "2026-01-17T10:00:00.000Z" } });

export type UpdateMarketingPushConsentResponse = z.infer<
  typeof updateMarketingPushConsentResponseSchema
>;

export const updateAiDataSharingConsentResponseSchema = z
  .object({
    aiDataSharingDecision: aiDataSharingDecisionSchema,
    aiDataSharingAgreedAt: nullableDatetimeSchema.describe(
      "AI 데이터 처리 동의 시각 (거부·철회 시 null)",
    ),
    aiDataSharingConsentVersion: z.string().describe("답한 AI 데이터 처리 안내 버전"),
  })
  .meta({
    example: {
      aiDataSharingDecision: "AGREED",
      aiDataSharingAgreedAt: "2026-10-26T09:00:00.000Z",
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    },
  });

export type UpdateAiDataSharingConsentResponse = z.infer<
  typeof updateAiDataSharingConsentResponseSchema
>;
