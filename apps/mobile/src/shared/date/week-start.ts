import { DAY_OF_WEEK_MAP, DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';

/** 달력 표시(월·주 달력, 날짜 피커, 요일 머리글, 위젯 주)의 주 시작. 지원하는 나라(한국·미국)의 달력 관례다 */
const CALENDAR_WEEK_START_DAY = 'SUN' satisfies DayOfWeek;

/** 주간 집계(리포트·주간 반복·ISO 주)의 주 시작. 서버의 주간 리포트 기간과 같아 나라에 따라 바꾸지 않는다 */
const AGGREGATION_WEEK_START_DAY = 'MON' satisfies DayOfWeek;

function getDaysSince(weekStartDay: DayOfWeek, dayOfWeek: number): number {
  return (dayOfWeek - DAY_OF_WEEK_MAP[weekStartDay] + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

/** 요일 번호(0=일 … 6=토)가 달력 주 시작에서 며칠째인지. 달력 칸의 열 번호다 */
export function getDaysSinceCalendarWeekStart(dayOfWeek: number): number {
  return getDaysSince(CALENDAR_WEEK_START_DAY, dayOfWeek);
}

/** 요일 번호(0=일 … 6=토)가 집계 주 시작에서 며칠째인지 */
export function getDaysSinceAggregationWeekStart(dayOfWeek: number): number {
  return getDaysSince(AGGREGATION_WEEK_START_DAY, dayOfWeek);
}

const CALENDAR_WEEK_START_INDEX = DAYS_OF_WEEK.indexOf(CALENDAR_WEEK_START_DAY);

/** 달력 표시 순서의 요일. 집계 순서인 `DAYS_OF_WEEK`를 달력 주 시작부터 돌린다 */
export const CALENDAR_DAYS_OF_WEEK: readonly DayOfWeek[] = [
  ...DAYS_OF_WEEK.slice(CALENDAR_WEEK_START_INDEX),
  ...DAYS_OF_WEEK.slice(0, CALENDAR_WEEK_START_INDEX),
];
