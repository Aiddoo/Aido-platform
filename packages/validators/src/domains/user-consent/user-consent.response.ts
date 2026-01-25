/**
 * User Consent Response 스키마
 *
 * 사용자 약관 동의 관련 응답 검증을 위한 Zod 스키마
 */
import { z } from 'zod';

// ============================================
// 동의 상태 엔티티
// ============================================

/** 사용자 동의 상태 스키마 */
export const userConsentSchema = z
  .object({
    termsAgreedAt: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .describe('서비스 이용약관 동의 시점'),
    privacyAgreedAt: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .describe('개인정보처리방침 동의 시점'),
    agreedTermsVersion: z.string().nullable().describe('동의한 약관 버전'),
    marketingAgreedAt: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .describe('마케팅 수신 동의 시점 (null = 미동의/철회)'),
  })
  .describe('사용자 동의 상태')
  .meta({
    example: {
      termsAgreedAt: '2026-01-17T10:00:00.000Z',
      privacyAgreedAt: '2026-01-17T10:00:00.000Z',
      agreedTermsVersion: '1.0.0',
      marketingAgreedAt: null,
    },
  });

export type UserConsent = z.infer<typeof userConsentSchema>;

// ============================================
// 동의 상태 조회 응답
// ============================================

/** 동의 상태 조회 응답 */
export const consentResponseSchema = userConsentSchema.describe('동의 상태 조회 응답').meta({
  example: {
    termsAgreedAt: '2026-01-17T10:00:00.000Z',
    privacyAgreedAt: '2026-01-17T10:00:00.000Z',
    agreedTermsVersion: '1.0.0',
    marketingAgreedAt: null,
  },
});

export type ConsentResponse = z.infer<typeof consentResponseSchema>;

// ============================================
// 마케팅 동의 변경 응답
// ============================================

/** 마케팅 동의 변경 응답 */
export const updateMarketingConsentResponseSchema = z
  .object({
    marketingAgreedAt: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .describe('마케팅 수신 동의 시점 (null = 철회됨)'),
  })
  .describe('마케팅 동의 변경 응답')
  .meta({
    example: {
      marketingAgreedAt: '2026-01-17T10:00:00.000Z',
    },
  });

export type UpdateMarketingConsentResponse = z.infer<typeof updateMarketingConsentResponseSchema>;
