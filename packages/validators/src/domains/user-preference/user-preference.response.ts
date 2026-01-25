/**
 * User Preference Response 스키마
 *
 * 사용자 푸시 알림 설정 관련 응답 검증을 위한 Zod 스키마
 */
import { z } from 'zod';

// ============================================
// 푸시 설정 엔티티
// ============================================

/** 사용자 푸시 설정 스키마 */
export const userPreferenceSchema = z
  .object({
    pushEnabled: z.boolean().describe('푸시 알림 전체 ON/OFF'),
    nightPushEnabled: z.boolean().describe('야간 푸시 알림 동의 (21:00-08:00 KST)'),
  })
  .describe('사용자 푸시 설정')
  .meta({
    example: {
      pushEnabled: true,
      nightPushEnabled: false,
    },
  });

export type UserPreference = z.infer<typeof userPreferenceSchema>;

// ============================================
// 푸시 설정 조회 응답
// ============================================

/** 푸시 설정 조회 응답 */
export const preferenceResponseSchema = userPreferenceSchema.describe('푸시 설정 조회 응답').meta({
  example: {
    pushEnabled: true,
    nightPushEnabled: false,
  },
});

export type PreferenceResponse = z.infer<typeof preferenceResponseSchema>;

// ============================================
// 푸시 설정 수정 응답
// ============================================

/** 푸시 설정 수정 응답 */
export const updatePreferenceResponseSchema = userPreferenceSchema
  .describe('푸시 설정 수정 응답')
  .meta({
    example: {
      pushEnabled: true,
      nightPushEnabled: true,
    },
  });

export type UpdatePreferenceResponse = z.infer<typeof updatePreferenceResponseSchema>;
