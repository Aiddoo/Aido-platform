import { z } from 'zod';

export const todoVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

export const dayOfWeekSchema = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

export const DAY_OF_WEEK_MAP: Record<DayOfWeek, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
} as const;

/** 월~일 순서 배열 (UI/통계 표시용) */
export const DAY_OF_WEEK_ORDER: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** 요일 한글 매핑 */
export const DAY_OF_WEEK_KO: Record<DayOfWeek, string> = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
  SUN: '일',
} as const;

/**
 * dayjs.day() (0=일요일) → DayOfWeek 변환
 *
 * dayjs는 일요일=0, 월요일=1 ... 토요일=6을 반환하지만,
 * DAY_OF_WEEK_ORDER는 월~일 순서이므로 인덱스 변환이 필요합니다.
 */
export function dayIndexToDayOfWeek(dayIndex: number): DayOfWeek {
  return DAY_OF_WEEK_ORDER[(dayIndex + 6) % 7] ?? 'MON';
}
