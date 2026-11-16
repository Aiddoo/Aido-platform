import { DAYS_PER_WEEK, HOURS_PER_DAY } from '@src/shared/constants/time-units';
import { type DateFormatContext, formatDateKeyLabel } from '@src/shared/date/format/date-format';
import { keyBy, range } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { AiReport, DailyCompletion, ReportType } from '../domains/report.model';

// 월간 막대는 칸이 좁아 라벨이 겹치므로 주마다 한 칸에만 날짜를 쓴다
export function getDailyCompletionLabels(
  type: ReportType,
  dailyCompletions: readonly DailyCompletion[],
  context: DateFormatContext,
): string[] {
  return match(type)
    .with('WEEKLY', () =>
      dailyCompletions.map((day) => formatDateKeyLabel(day.date, 'weekday', context)),
    )
    .with('MONTHLY', () =>
      dailyCompletions.map((day, index) =>
        index % DAYS_PER_WEEK === 0 ? formatDateKeyLabel(day.date, 'dayNumber', context) : '',
      ),
    )
    .exhaustive();
}

// 서버는 끝낸 일이 있는 시각만 보내므로 나머지 시각을 0으로 채워 24칸을 만든다
export function getHourlyCompletionCounts(report: AiReport): number[] {
  const patternByHour = keyBy(report.timePatterns, (pattern) => pattern.hour);
  return range(HOURS_PER_DAY).map((hour) => patternByHour[hour]?.count ?? 0);
}
