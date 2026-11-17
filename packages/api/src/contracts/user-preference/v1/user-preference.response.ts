import { z } from "zod";

import {
  TIME_FORMATS,
  USER_PREFERENCE_DEFAULTS,
} from "../../../vocabulary/user-preference.constants.js";

export const userPreferenceSchema = z
  .object({
    pushEnabled: z.boolean().meta({ description: "푸시 알림 전체 활성화 여부" }),
    nightPushEnabled: z.boolean().meta({ description: "야간 푸시 알림 활성화 여부 (21:00-08:00)" }),
    timezone: z.string().meta({ description: "IANA 타임존" }),
    morningReminderHour: z.int().meta({ description: "아침 리마인더 시간 (0-11)" }),
    morningReminderMinute: z.int().meta({ description: "아침 리마인더 분 (0-59)" }),
    eveningReminderHour: z.int().meta({ description: "저녁 리마인더 시간 (12-23)" }),
    eveningReminderMinute: z.int().meta({ description: "저녁 리마인더 분 (0-59)" }),
    timeFormat: z
      .enum(TIME_FORMATS)
      .meta({ description: "시간 표시 형식 (TWELVE_HOUR: 12시간제, TWENTY_FOUR_HOUR: 24시간제)" }),
    weatherMorningEnabled: z.boolean().meta({ description: "오전 날씨 알림 활성화 여부" }),
    weatherMorningHour: z.int().meta({ description: "오전 날씨 알림 시간 (0-23)" }),
    weatherMorningMinute: z.int().meta({ description: "오전 날씨 알림 분 (0-59)" }),
    weatherEveningEnabled: z.boolean().meta({ description: "오후 날씨 알림 활성화 여부" }),
    weatherEveningHour: z.int().meta({ description: "오후 날씨 알림 시간 (0-23)" }),
    weatherEveningMinute: z.int().meta({ description: "오후 날씨 알림 분 (0-59)" }),
    aiPushEnabled: z.boolean().meta({
      description: "AI 제안·주간·월간 리포트 푸시 활성화 여부 (1.16.0+, 알림함 기록은 그대로 남음)",
    }),
  })
  .meta({
    example: {
      pushEnabled: true,
      nightPushEnabled: false,
      timezone: "Asia/Seoul",
      morningReminderHour: 8,
      morningReminderMinute: 0,
      eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
      eveningReminderMinute: 0,
      timeFormat: "TWELVE_HOUR",
      weatherMorningEnabled: false,
      weatherMorningHour: 7,
      weatherMorningMinute: 0,
      weatherEveningEnabled: false,
      weatherEveningHour: 18,
      weatherEveningMinute: 0,
      aiPushEnabled: true,
    },
  });

export type UserPreference = z.infer<typeof userPreferenceSchema>;

export const preferenceResponseSchema = userPreferenceSchema.meta({
  example: {
    pushEnabled: true,
    nightPushEnabled: false,
    timezone: "Asia/Seoul",
    morningReminderHour: 8,
    morningReminderMinute: 0,
    eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
    eveningReminderMinute: 0,
    timeFormat: "TWELVE_HOUR",
    weatherMorningEnabled: false,
    weatherMorningHour: 7,
    weatherMorningMinute: 0,
    weatherEveningEnabled: false,
    weatherEveningHour: 18,
    weatherEveningMinute: 0,
    aiPushEnabled: true,
  },
});

export type PreferenceResponse = z.infer<typeof preferenceResponseSchema>;

export const updatePreferenceResponseSchema = userPreferenceSchema.meta({
  example: {
    pushEnabled: true,
    nightPushEnabled: true,
    timezone: "Asia/Seoul",
    morningReminderHour: 8,
    morningReminderMinute: 0,
    eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
    eveningReminderMinute: 0,
    timeFormat: "TWELVE_HOUR",
    weatherMorningEnabled: true,
    weatherMorningHour: 7,
    weatherMorningMinute: 0,
    weatherEveningEnabled: true,
    weatherEveningHour: 18,
    weatherEveningMinute: 0,
    aiPushEnabled: true,
  },
});

export type UpdatePreferenceResponse = z.infer<typeof updatePreferenceResponseSchema>;
