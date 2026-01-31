import { z } from 'zod';

import { nullableDatetimeSchema } from '../../common/datetime';

export const userConsentSchema = z
  .object({
    termsAgreedAt: nullableDatetimeSchema.describe(
      '서비스 이용약관 동의 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z, 미동의 시 null)',
    ),
    privacyAgreedAt: nullableDatetimeSchema.describe(
      '개인정보처리방침 동의 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z, 미동의 시 null)',
    ),
    agreedTermsVersion: z
      .string()
      .nullable()
      .describe('동의한 약관 버전 (예: 1.0.0, 미동의 시 null)'),
    marketingAgreedAt: nullableDatetimeSchema.describe(
      '마케팅 수신 동의 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z, 미동의 시 null)',
    ),
  })
  .meta({
    example: {
      termsAgreedAt: '2026-01-17T10:00:00.000Z',
      privacyAgreedAt: '2026-01-17T10:00:00.000Z',
      agreedTermsVersion: '1.0.0',
      marketingAgreedAt: null,
    },
  });

export type UserConsent = z.infer<typeof userConsentSchema>;

export const consentResponseSchema = userConsentSchema.meta({
  example: {
    termsAgreedAt: '2026-01-17T10:00:00.000Z',
    privacyAgreedAt: '2026-01-17T10:00:00.000Z',
    agreedTermsVersion: '1.0.0',
    marketingAgreedAt: null,
  },
});

export type ConsentResponse = z.infer<typeof consentResponseSchema>;

export const updateMarketingConsentResponseSchema = z
  .object({
    marketingAgreedAt: nullableDatetimeSchema.describe(
      '마케팅 수신 동의 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z, 철회 시 null)',
    ),
  })
  .meta({
    example: {
      marketingAgreedAt: '2026-01-17T10:00:00.000Z',
    },
  });

export type UpdateMarketingConsentResponse = z.infer<typeof updateMarketingConsentResponseSchema>;
