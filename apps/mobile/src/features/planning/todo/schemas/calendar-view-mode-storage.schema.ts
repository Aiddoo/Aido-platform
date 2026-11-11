import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

export const calendarViewModeSchema = z.enum(['week', 'month']);
export type CalendarViewMode = z.infer<typeof calendarViewModeSchema>;

/** 달력의 주·월 보기. 계정과 무관한 기기 설정이다 */
export const calendarViewModeStoredValue = defineStoredValue({
  key: 'aido_calendar_view_mode',
  schema: calendarViewModeSchema,
  fallback: 'week',
});
