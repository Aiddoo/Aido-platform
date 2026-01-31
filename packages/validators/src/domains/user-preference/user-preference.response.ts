import { z } from 'zod';

export const userPreferenceSchema = z
  .object({
    pushEnabled: z.boolean().describe('푸시 알림 전체 활성화 여부'),
    nightPushEnabled: z.boolean().describe('야간 푸시 알림 활성화 여부 (21:00-08:00)'),
  })
  .meta({
    example: {
      pushEnabled: true,
      nightPushEnabled: false,
    },
  });

export type UserPreference = z.infer<typeof userPreferenceSchema>;

export const preferenceResponseSchema = userPreferenceSchema.meta({
  example: {
    pushEnabled: true,
    nightPushEnabled: false,
  },
});

export type PreferenceResponse = z.infer<typeof preferenceResponseSchema>;

export const updatePreferenceResponseSchema = userPreferenceSchema.meta({
  example: {
    pushEnabled: true,
    nightPushEnabled: true,
  },
});

export type UpdatePreferenceResponse = z.infer<typeof updatePreferenceResponseSchema>;
