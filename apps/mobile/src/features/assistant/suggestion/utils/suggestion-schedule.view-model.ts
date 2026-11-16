import type { TodoRepeat } from '@src/features/planning/todo/domains/todo-repeat.model';
import {
  type DateFormatContext,
  formatClockTime,
  formatDateLabel,
  formatHHmmTime,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { formatDaysOfWeek } from '@src/shared/date/format/date-labels';
import type { Instant } from '@src/shared/date/instant';
import { toLanguageOfIntlLocale } from '@src/shared/i18n/app-locales';

import type { AiSuggestion } from '../domains/suggestion.model';

interface SuggestionSchedule {
  repeat: TodoRepeat;
  timeLabel: string | null;
}

export function formatRepeatDays(
  daysOfWeek: AiSuggestion['daysOfWeek'],
  context: DateFormatContext,
): string {
  return formatDaysOfWeek(daysOfWeek, toLanguageOfIntlLocale(context.locale));
}

/** 수락하면 서버가 고른 요일마다 반복하는 할 일을 만든다. 일정 줄은 주기만 그려 끝나는 날은 두지 않는다 */
export function getSuggestionSchedule(
  { daysOfWeek, scheduledTime }: Pick<AiSuggestion, 'daysOfWeek' | 'scheduledTime'>,
  {
    timeFormat,
    dateFormatContext,
  }: { timeFormat: TimeFormat; dateFormatContext: DateFormatContext },
): SuggestionSchedule {
  return {
    repeat: { frequency: 'WEEKLY', interval: 1, weekdays: daysOfWeek, end: { type: 'NEVER' } },
    timeLabel:
      scheduledTime == null ? null : formatHHmmTime(scheduledTime, timeFormat, dateFormatContext),
  };
}

export function getNextAnalysisLabels(
  nextAnalysisAt: Instant,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): { date: string; time: string } {
  return {
    date: formatDateLabel(nextAnalysisAt, 'monthDay', context),
    time: formatClockTime(nextAnalysisAt, timeFormat, context),
  };
}
