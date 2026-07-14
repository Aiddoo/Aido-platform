import { z } from 'zod';

export const updateMarketingConsentSchema = z.object({
  agreed: z.boolean().describe('마케팅 수신 동의 여부 (true: 동의, false: 철회)'),
});

export type UpdateMarketingConsentInput = z.infer<typeof updateMarketingConsentSchema>;

export const updateMarketingPushConsentSchema = z.object({
  agreed: z.boolean().describe('광고성 앱 푸시 수신 동의 여부'),
});

export type UpdateMarketingPushConsentInput = z.infer<typeof updateMarketingPushConsentSchema>;
