import { useLocalDate } from '@src/shared/providers/local-date-provider';

/** 현재 로컬 날짜를 나타내는 안정적인 Date. 날짜가 바뀔 때만 참조가 변경된다. */
export const useToday = (): Date => useLocalDate().currentLocalDate;

/** 쿼리·경계 reset에 사용하는 YYYY-MM-DD 로컬 날짜 key. */
export const useTodayKey = (): string => useLocalDate().currentLocalDateKey;
