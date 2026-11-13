import { formatTodoPeriod } from '@src/features/planning/todo/utils/todo-period.view-model';
import { formatRepeatSummary } from '@src/features/planning/todo/utils/todo-repeat-summary.view-model';
import type { DateKey } from '@src/shared/date/date-key';
import {
  type DateFormatContext,
  formatTimeOfDay,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { toTimeOfDay } from '@src/shared/date/time-of-day';
import { compact } from 'es-toolkit';

import type { PlanTodoFormValues } from '../schemas/plan-review-form.schema';

interface PlanTodoSubtitleContext {
  todayKey: DateKey;
  timeFormat: TimeFormat;
  dateFormatContext: DateFormatContext;
}

/** 검토 카드 제목 아래 한 줄. 보일 것이 없으면 null이다 */
export function getPlanTodoSubtitle(
  todo: Pick<PlanTodoFormValues, 'startDate' | 'endDate' | 'scheduledTime' | 'repeat'>,
  { todayKey, timeFormat, dateFormatContext }: PlanTodoSubtitleContext,
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
