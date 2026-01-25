/**
 * User Preference Request DTO 스키마
 *
 * 사용자 푸시 알림 설정 관련 요청 검증을 위한 Zod 스키마
 */
import { z } from 'zod';

// ============================================
// 푸시 설정 수정
// ============================================

/** 푸시 설정 수정 요청 */
export const updatePreferenceSchema = z
  .object({
    pushEnabled: z.boolean().optional().describe('푸시 알림 전체 ON/OFF'),
    nightPushEnabled: z.boolean().optional().describe('야간 푸시 알림 동의 (21:00-08:00 KST)'),
  })
  .refine((data) => data.pushEnabled !== undefined || data.nightPushEnabled !== undefined, {
    message: '최소 하나의 설정 값이 필요합니다',
  })
  .describe('푸시 설정 수정 요청');

export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;
