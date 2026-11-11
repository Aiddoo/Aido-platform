import { formatRepeatSummary } from '@src/features/planning/todo/utils/format-repeat-summary';
import {
  type DateFormatContext,
  formatDateKeyRange,
  formatTimeOfDay,
  formatYearAwareDateKeyLabel,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { toTimeOfDay } from '@src/shared/date/time-of-day';
import { compact } from 'es-toolkit';
import { match, P } from 'ts-pattern';

import type { PlanTodoFormValues } from '../schemas/plan-review-form.schema';

interface PlanTodoSubtitleContext {
  todayKey: string;
  timeFormat: TimeFormat;
  dateFormatContext: DateFormatContext;
}

/** 검토 카드 제목 아래 한 줄. 보일 것이 없으면 null이다 */
export function getPlanTodoSubtitle(
  todo: Pick<PlanTodoFormValues, 'startDate' | 'endDate' | 'scheduledTime' | 'repeat'>,
  { todayKey, timeFormat, dateFormatContext }: PlanTodoSubtitleContext,
): string | null {
  const dateLabel = match(todo)
    .with({ endDate: P.nonNullable }, ({ startDate, endDate }) =>
      formatDateKeyRange(startDate, endDate, todayKey, dateFormatContext),
    )
    // 반복은 시작일보다 반복 규칙이 중요해 날짜를 숨기고, 오늘 할 일도 날짜를 보이지 않는다
    .when(
      ({ repeat, startDate }) => repeat == null && startDate !== todayKey,
      ({ startDate }) => formatYearAwareDateKeyLabel(startDate, todayKey, dateFormatContext),
    )
    .otherwise(() => null);
  const timeLabel =
    todo.scheduledTime == null
      ? null
      : formatTimeOfDay(toTimeOfDay(todo.scheduledTime), timeFormat, dateFormatContext);
  const repeatLabel =
    todo.repeat == null ? null : formatRepeatSummary(todo.repeat, todayKey, dateFormatContext);
  const parts = compact([dateLabel, timeLabel, repeatLabel]);

  return parts.length === 0 ? null : parts.join(' · ');
}
