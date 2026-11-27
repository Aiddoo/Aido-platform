import type { DateKey } from '@src/shared/date/date-key';
import {
  type DateFormatContext,
  formatTimeOfDay,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { toTimeOfDay } from '@src/shared/date/time-of-day';
import { compact } from 'es-toolkit';

import type { TodoRepeat } from '../domains/todo-repeat.model';
import { formatTodoPeriod } from './todo-period.view-model';
import { formatRepeatSummary } from './todo-repeat-summary.view-model';

/** 아직 저장하지 않은 할 일도 같은 칸을 쓴다(작성 폼, 계획 검토 카드) */
export interface TodoScheduleSummaryValue {
  startDate: DateKey;
  endDate: DateKey | null;
  scheduledTime: string | null;
  repeat: TodoRepeat | null;
}

interface TodoScheduleSummaryContext {
  todayKey: DateKey;
  timeFormat: TimeFormat;
  dateFormatContext: DateFormatContext;
}

/** 할 일 제목 아래 한 줄(기간 · 시각 · 반복). 보일 것이 없으면 null이다 */
export function findTodoScheduleSummary(
  todo: TodoScheduleSummaryValue,
  { todayKey, timeFormat, dateFormatContext }: TodoScheduleSummaryContext,
): string | null {
  // 하루짜리 반복은 시작일보다 반복 규칙이 중요해 날짜를 숨긴다
  const isSingleDayRepeat = todo.repeat != null && todo.endDate == null;
  const dateLabel = isSingleDayRepeat ? null : formatTodoPeriod(todo, todayKey, dateFormatContext);
  const timeLabel =
    todo.scheduledTime == null
      ? null
      : formatTimeOfDay(toTimeOfDay(todo.scheduledTime), timeFormat, dateFormatContext);
  const repeatLabel =
    todo.repeat == null ? null : formatRepeatSummary(todo.repeat, todayKey, dateFormatContext);
  const parts = compact([dateLabel, timeLabel, repeatLabel]);

  return parts.length === 0 ? null : parts.join(' · ');
}
