import { z } from 'zod';
import { TIME_FORMATS } from './user-preference.constants';

export const userPreferenceSchema = z
  .object({
    pushEnabled: z.boolean().describe('푸시 알림 전체 활성화 여부'),
    nightPushEnabled: z.boolean().describe('야간 푸시 알림 활성화 여부 (21:00-08:00)'),
    timezone: z.string().describe('IANA 타임존'),
    morningReminderHour: z.number().int().describe('아침 리마인더 시간 (0-11)'),
    morningReminderMinute: z.number().int().describe('아침 리마인더 분 (0-59)'),
    eveningReminderHour: z.number().int().describe('저녁 리마인더 시간 (12-23)'),
    eveningReminderMinute: z.number().int().describe('저녁 리마인더 분 (0-59)'),
    timeFormat: z
      .enum(TIME_FORMATS)
      .describe('시간 표시 형식 (TWELVE_HOUR: 12시간제, TWENTY_FOUR_HOUR: 24시간제)'),
  })
  .meta({
    example: {
      pushEnabled: true,
      nightPushEnabled: false,
      timezone: 'Asia/Seoul',
      morningReminderHour: 8,
      morningReminderMinute: 0,
      eveningReminderHour: 18,
      eveningReminderMinute: 0,
      timeFormat: 'TWELVE_HOUR',
    },
  });

export type UserPreference = z.infer<typeof userPreferenceSchema>;

export const preferenceResponseSchema = userPreferenceSchema.meta({
  example: {
    pushEnabled: true,
    nightPushEnabled: false,
    timezone: 'Asia/Seoul',
    morningReminderHour: 8,
    morningReminderMinute: 0,
    eveningReminderHour: 18,
    eveningReminderMinute: 0,
    timeFormat: 'TWELVE_HOUR',
  },
});

export type PreferenceResponse = z.infer<typeof preferenceResponseSchema>;

export const updatePreferenceResponseSchema = userPreferenceSchema.meta({
  example: {
    pushEnabled: true,
    nightPushEnabled: true,
    timezone: 'Asia/Seoul',
    morningReminderHour: 8,
    morningReminderMinute: 0,
    eveningReminderHour: 18,
    eveningReminderMinute: 0,
    timeFormat: 'TWELVE_HOUR',
  },
});

export type UpdatePreferenceResponse = z.infer<typeof updatePreferenceResponseSchema>;
