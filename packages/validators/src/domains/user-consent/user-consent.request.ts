import { z } from 'zod';

export const updateMarketingConsentSchema = z.object({
  agreed: z.boolean().describe('마케팅 수신 동의 여부 (true: 동의, false: 철회)'),
});

export type UpdateMarketingConsentInput = z.infer<typeof updateMarketingConsentSchema>;
