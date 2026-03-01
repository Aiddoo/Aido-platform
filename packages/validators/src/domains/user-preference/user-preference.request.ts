import { z } from 'zod';
import {
  EVENING_REMINDER_HOUR_RANGE,
  MORNING_REMINDER_HOUR_RANGE,
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
    eveningReminderHour: z
      .number()
      .int()
      .min(EVENING_REMINDER_HOUR_RANGE.MIN)
      .max(EVENING_REMINDER_HOUR_RANGE.MAX)
      .optional()
      .describe('저녁 리마인더 시간 (12-23, 오후만 허용)'),
  })
  .refine(
    (data) =>
      data.pushEnabled !== undefined ||
      data.nightPushEnabled !== undefined ||
      data.timezone !== undefined ||
      data.morningReminderHour !== undefined ||
      data.eveningReminderHour !== undefined,
    { message: '최소 하나의 설정 값이 필요합니다' },
  );

export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;
