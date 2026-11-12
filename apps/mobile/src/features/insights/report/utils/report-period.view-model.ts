import type { DateKey } from '@src/shared/date/date-key';
import { type DateFormatContext, formatDateKeyLabel } from '@src/shared/date/format/date-format';
import { formatIsoWeekLabel } from '@src/shared/date/format/date-labels';

import type { AiReport } from '../domains/report.model';

/** 서버가 보낸 기간 라벨은 만든 시점의 언어로 굳어 있어 기간 첫날로 앱 언어에 맞게 만든다. 주간은 주간 성취와 같은 주차이고 다른 해 주는 연도를 붙인다 */
export function formatReportPeriodLabel(
  { type, dateRange }: Pick<AiReport, 'type' | 'dateRange'>,
  todayDateKey: DateKey,
  context: DateFormatContext,
): string {
  return type === 'WEEKLY'
    ? formatIsoWeekLabel(dateRange.startDate, todayDateKey, context)
    : formatDateKeyLabel(dateRange.startDate, 'yearMonth', context);
}
