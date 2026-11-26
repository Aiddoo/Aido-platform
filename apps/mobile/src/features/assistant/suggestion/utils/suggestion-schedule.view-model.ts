import {
  type DateFormatContext,
  formatClockTime,
  formatDateLabel,
  formatHHmmTime,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import type { Instant } from '@src/shared/date/instant';

import type { AiSuggestion } from '../domains/ai-suggestion.model';

/** 일정 줄의 시각. 시각 없이 반복하는 제안은 null이다 */
export function formatSuggestionTime(
  suggestion: AiSuggestion,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string | null {
  return suggestion.scheduledTime == null
    ? null
    : formatHHmmTime(suggestion.scheduledTime, timeFormat, context);
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
