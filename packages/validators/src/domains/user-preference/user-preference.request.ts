import { z } from 'zod';
import {
  EVENING_REMINDER_HOUR_RANGE,
  MORNING_REMINDER_HOUR_RANGE,
  TIME_FORMATS,
  WEATHER_HOUR_RANGE,
} from './user-preference.constants';

export const updatePreferenceSchema = z
  .object({
    pushEnabled: z.boolean().optional().describe('푸시 알림 전체 활성화 여부'),
    nightPushEnabled: z.boolean().optional().describe('야간 푸시 알림 활성화 여부 (21:00-08:00)'),
    timezone: z
      .string()
      .min(1)
      .max(50)
      .optional()
      .describe('IANA 타임존 (e.g. "Asia/Seoul", "America/New_York")'),
    morningReminderHour: z
      .number()
      .int()
      .min(MORNING_REMINDER_HOUR_RANGE.MIN)
      .max(MORNING_REMINDER_HOUR_RANGE.MAX)
      .optional()
      .describe('아침 리마인더 시간 (0-11, 오전만 허용)'),
    morningReminderMinute: z
      .number()
      .int()
      .min(0)
      .max(59)
      .optional()
      .describe('아침 리마인더 분 (0-59)'),
    eveningReminderHour: z
      .number()
      .int()
      .min(EVENING_REMINDER_HOUR_RANGE.MIN)
      .max(EVENING_REMINDER_HOUR_RANGE.MAX)
      .optional()
      .describe('저녁 리마인더 시간 (12-23, 오후만 허용)'),
    eveningReminderMinute: z
      .number()
      .int()
      .min(0)
      .max(59)
      .optional()
      .describe('저녁 리마인더 분 (0-59)'),
    timeFormat: z
      .enum(TIME_FORMATS)
      .optional()
      .describe('시간 표시 형식 (TWELVE_HOUR: 12시간제, TWENTY_FOUR_HOUR: 24시간제)'),
    weatherMorningEnabled: z.boolean().optional().describe('오전 날씨 알림 활성화 여부'),
    weatherMorningHour: z
      .number()
      .int()
      .min(WEATHER_HOUR_RANGE.MIN)
      .max(WEATHER_HOUR_RANGE.MAX)
      .optional()
      .describe('오전 날씨 알림 시간 (0-23)'),
    weatherMorningMinute: z
      .number()
      .int()
      .min(0)
      .max(59)
      .optional()
      .describe('오전 날씨 알림 분 (0-59)'),
    weatherEveningEnabled: z.boolean().optional().describe('오후 날씨 알림 활성화 여부'),
    weatherEveningHour: z
      .number()
      .int()
      .min(WEATHER_HOUR_RANGE.MIN)
      .max(WEATHER_HOUR_RANGE.MAX)
      .optional()
      .describe('오후 날씨 알림 시간 (0-23)'),
    weatherEveningMinute: z
      .number()
      .int()
      .min(0)
      .max(59)
      .optional()
      .describe('오후 날씨 알림 분 (0-59)'),
  })
  .refine(
    (data) =>
      data.pushEnabled !== undefined ||
      data.nightPushEnabled !== undefined ||
      data.timezone !== undefined ||
      data.morningReminderHour !== undefined ||
      data.morningReminderMinute !== undefined ||
      data.eveningReminderHour !== undefined ||
      data.eveningReminderMinute !== undefined ||
      data.timeFormat !== undefined ||
      data.weatherMorningEnabled !== undefined ||
      data.weatherMorningHour !== undefined ||
      data.weatherMorningMinute !== undefined ||
      data.weatherEveningEnabled !== undefined ||
      data.weatherEveningHour !== undefined ||
      data.weatherEveningMinute !== undefined,
    { message: '최소 하나의 설정 값이 필요합니다' },
  );

export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;
