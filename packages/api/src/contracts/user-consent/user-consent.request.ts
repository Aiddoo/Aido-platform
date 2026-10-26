import { z } from "zod";

import { AI_DATA_SHARING_CONSENT } from "../../vocabulary/user-consent.constants.js";

export const updateMarketingConsentSchema = z.object({
  agreed: z.boolean().describe("마케팅 수신 동의 여부 (true: 동의, false: 철회)"),
});

export type UpdateMarketingConsentInput = z.infer<typeof updateMarketingConsentSchema>;

export const updateMarketingPushConsentSchema = z.object({
  agreed: z.boolean().describe("광고성 앱 푸시 수신 동의 여부"),
});

export type UpdateMarketingPushConsentInput = z.infer<typeof updateMarketingPushConsentSchema>;

export const updateAiDataSharingConsentSchema = z
  .object({
    agreed: z
      .boolean()
      .describe("AI 데이터 처리(Google Gemini 전송) 동의 여부 (true: 동의, false: 거부·철회)"),
    version: z
      .literal(AI_DATA_SHARING_CONSENT.VERSION)
      .describe(`사용자에게 보여 준 안내 버전 (현재: ${AI_DATA_SHARING_CONSENT.VERSION})`),
  })
  .meta({ example: { agreed: true, version: AI_DATA_SHARING_CONSENT.VERSION } });

export type UpdateAiDataSharingConsentInput = z.infer<typeof updateAiDataSharingConsentSchema>;
