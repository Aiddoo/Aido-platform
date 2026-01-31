import { z } from 'zod';

export const updatePreferenceSchema = z
  .object({
    pushEnabled: z.boolean().optional().describe('푸시 알림 전체 활성화 여부 (선택)'),
    nightPushEnabled: z
      .boolean()
      .optional()
      .describe('야간 푸시 알림 활성화 여부 (선택, 21:00-08:00)'),
  })
  .refine((data) => data.pushEnabled !== undefined || data.nightPushEnabled !== undefined, {
    message: '최소 하나의 설정 값이 필요합니다',
  });

export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;
