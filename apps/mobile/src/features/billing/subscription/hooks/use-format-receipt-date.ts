import { formatDateLabel, formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { type Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { match } from 'ts-pattern';

import type { toReceiptDateLabel } from '../utils/subscription-receipt.view-model';

/** 영수증과 마이 탭 요약이 같은 날짜 표기를 쓴다 */
export function useFormatReceiptDate(dateLabel: ReturnType<typeof toReceiptDateLabel>) {
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  return (date: Instant) =>
    match(dateLabel)
      .with('fullDate', (kind) => formatDateLabel(date, kind, dateFormatContext))
      .with('yearAware', () => formatYearAwareDateLabel(date, todayKey, dateFormatContext))
      .exhaustive();
}
