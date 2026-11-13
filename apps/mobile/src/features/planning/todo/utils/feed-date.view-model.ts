import type { DateKey } from '@src/shared/date/date-key';

import type { FeedDateParam } from '../schemas/feed-params.schema';

/** 없거나 `today`면 오늘을 따라간다. 고른 날짜만 자정이 지나도 그대로 둔다 */
export function toFeedDateKey(date: FeedDateParam, todayKey: DateKey): DateKey {
  return date == null || date === 'today' ? todayKey : date;
}
