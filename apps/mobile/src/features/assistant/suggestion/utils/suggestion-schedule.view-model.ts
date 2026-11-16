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

export function formatRepeatDays(
  daysOfWeek: AiSuggestion['daysOfWeek'],
  context: DateFormatContext,
): string {
  return formatDaysOfWeek(daysOfWeek, toLanguageOfIntlLocale(context.locale));
}

export function formatScheduledTime(
  scheduledTime: string,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  return formatHHmmTime(scheduledTime, timeFormat, context);
}

export function formatNextAnalysisAt(
  nextAnalysisAt: Instant,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  const date = formatDateLabel(nextAnalysisAt, 'monthDay', context);
  return `${date} ${formatClockTime(nextAnalysisAt, timeFormat, context)}`;
}
