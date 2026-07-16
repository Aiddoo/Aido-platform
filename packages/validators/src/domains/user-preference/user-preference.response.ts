import { z } from 'zod';
import { TIME_FORMATS, USER_PREFERENCE_DEFAULTS } from './user-preference.constants';

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
    weatherMorningEnabled: z.boolean().describe('오전 날씨 알림 활성화 여부'),
    weatherMorningHour: z.number().int().describe('오전 날씨 알림 시간 (0-23)'),
    weatherMorningMinute: z.number().int().describe('오전 날씨 알림 분 (0-59)'),
    weatherEveningEnabled: z.boolean().describe('오후 날씨 알림 활성화 여부'),
    weatherEveningHour: z.number().int().describe('오후 날씨 알림 시간 (0-23)'),
    weatherEveningMinute: z.number().int().describe('오후 날씨 알림 분 (0-59)'),
  })
  .meta({
    example: {
      pushEnabled: true,
      nightPushEnabled: false,
      timezone: 'Asia/Seoul',
      morningReminderHour: 8,
      morningReminderMinute: 0,
      eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
      eveningReminderMinute: 0,
      timeFormat: 'TWELVE_HOUR',
      weatherMorningEnabled: false,
      weatherMorningHour: 7,
      weatherMorningMinute: 0,
      weatherEveningEnabled: false,
      weatherEveningHour: 18,
      weatherEveningMinute: 0,
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
    eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
    eveningReminderMinute: 0,
    timeFormat: 'TWELVE_HOUR',
    weatherMorningEnabled: false,
    weatherMorningHour: 7,
    weatherMorningMinute: 0,
    weatherEveningEnabled: false,
    weatherEveningHour: 18,
    weatherEveningMinute: 0,
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
    eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
    eveningReminderMinute: 0,
    timeFormat: 'TWELVE_HOUR',
    weatherMorningEnabled: true,
    weatherMorningHour: 7,
    weatherMorningMinute: 0,
    weatherEveningEnabled: true,
    weatherEveningHour: 18,
    weatherEveningMinute: 0,
  },
});

export type UpdatePreferenceResponse = z.infer<typeof updatePreferenceResponseSchema>;
