/**
 * User Consent Request DTO 스키마
 *
 * 사용자 약관 동의 관련 요청 검증을 위한 Zod 스키마
 */
import { z } from 'zod';

// ============================================
// 마케팅 동의 변경
// ============================================

/** 마케팅 동의 변경 요청 */
export const updateMarketingConsentSchema = z
  .object({
    agreed: z.boolean().describe('마케팅 수신 동의 여부 (true: 동의, false: 철회)'),
  })
  .describe('마케팅 동의 변경 요청');

export type UpdateMarketingConsentInput = z.infer<typeof updateMarketingConsentSchema>;
