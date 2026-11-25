import type { DateKey } from '@src/shared/date/date-key';
import { useLocalDate } from '@src/shared/providers/local-date-provider';

/** 쿼리·경계 reset에 사용하는 YYYY-MM-DD 로컬 날짜 key. */
export function useTodayKey(): DateKey {
  return useLocalDate().currentLocalDateKey;
}
