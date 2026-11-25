import { TODO_SERIES_LIMITS } from '@aido/api/vocabulary';
import {
  addDaysToDateKey,
  type DateKey,
  dateKeySchema,
  getMonthEndDateKey,
} from '@src/shared/date/date-key';
import { z } from 'zod';

import { todoRepeatSchema } from './todo-repeat.model';

export const todoSeriesSchema = z.object({
  id: z.string(),
  repeat: todoRepeatSchema,
  startDate: dateKeySchema,
});
export type TodoSeries = z.infer<typeof todoSeriesSchema>;

// 서버가 반복 회차를 미리 만드는 범위(오늘 + VISIBLE_AHEAD_DAYS, 그 날 포함)를 넘어간 날짜인지
export function isBeyondRepeatHorizon(dateKey: DateKey, todayKey: DateKey): boolean {
  return dateKey > addDaysToDateKey(todayKey, TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS);
}

// 그 날짜가 속한 달의 마지막 날이 미리 만드는 범위를 넘어가는지. 달력에서 일부라도 비어 보일 수 있는 달이다
export function isMonthBeyondRepeatHorizon(dateKey: DateKey, todayKey: DateKey): boolean {
  return isBeyondRepeatHorizon(getMonthEndDateKey(dateKey), todayKey);
}
