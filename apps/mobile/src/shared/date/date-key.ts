import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(isoWeek);

const DATE_KEY_FORMAT = 'YYYY-MM-DD';
const MONDAY = 1;

/** YYYY-MM-DD를 UTC 자정으로 읽는다. 시간대와 DST가 끼지 않아 달력 계산이 하루 단위로 정확하다. */
function parseDateKey(dateKey: string) {
  return dayjs.utc(dateKey);
}

/** 잘못된 키에서 나온 날짜는 'Invalid Date' 글자 대신 빈 문자열이다. */
function formatDateKey(date: dayjs.Dayjs): string {
  return date.isValid() ? date.format(DATE_KEY_FORMAT) : '';
}

/** YYYY-MM-DD에 달력 일수를 더한다 (윤년·월말·연말 포함, 시간대 무관). */
export function addDaysToDateKey(dateKey: string, days: number): string {
  return formatDateKey(parseDateKey(dateKey).add(days, 'day'));
}

/** YYYY-MM-DD에 달 수를 더한다. 말일을 넘기면 그 달의 마지막 날로 맞춘다 (1월 31일 + 1달 = 2월 28일). */
export function addMonthsToDateKey(dateKey: string, months: number): string {
  return formatDateKey(parseDateKey(dateKey).add(months, 'month'));
}

export function getMonthStartDateKey(dateKey: string): string {
  return formatDateKey(parseDateKey(dateKey).startOf('month'));
}

/** 두 YYYY-MM-DD의 달 차이 (to - from). 일은 보지 않고 달만 센다. */
export function diffDateKeysInMonths(from: string, to: string): number {
  return parseDateKey(to).startOf('month').diff(parseDateKey(from).startOf('month'), 'month');
}

/** 두 YYYY-MM-DD 사이의 달력 일수 (to - from, 시간대·DST 무관). */
export function diffDateKeysInDays(from: string, to: string): number {
  return parseDateKey(to).diff(parseDateKey(from), 'day');
}

/** YYYY-MM-DD의 요일 (0=일 … 6=토, Date#getDay()와 같은 인덱스). */
export function getDayOfWeek(dateKey: string): number {
  return parseDateKey(dateKey).day();
}

/** 그 날이 속한 월요일 시작 주의 월요일. 일요일은 앞선 월요일로 간다. */
export function getMondayOfDateKey(dateKey: string): string {
  return formatDateKey(parseDateKey(dateKey).isoWeekday(MONDAY));
}

export function getDayOfMonth(dateKey: string): number {
  return parseDateKey(dateKey).date();
}

export function getYearOfDateKey(dateKey: string): number {
  return parseDateKey(dateKey).year();
}

/** 그 날이 속한 ISO 주(월요일 시작)의 연도. 연말·연초에는 달력 연도와 다르다 (2027-01-01 → 2026). */
export function getIsoWeekYear(dateKey: string): number {
  return parseDateKey(dateKey).isoWeekYear();
}

export function getDaysInDateKeyMonth(dateKey: string): number {
  return parseDateKey(dateKey).daysInMonth();
}

export function getMonthEndDateKey(dateKey: string): string {
  return formatDateKey(parseDateKey(dateKey).endOf('month'));
}

export function isSameMonthDateKey(first: string, second: string): boolean {
  return parseDateKey(first).isSame(parseDateKey(second), 'month');
}

export function isSameYearDateKey(first: string, second: string): boolean {
  return parseDateKey(first).isSame(parseDateKey(second), 'year');
}

export interface CalendarWeek {
  startDateKey: string;
  endDateKey: string;
  weekOfMonth: number;
}

/**
 * 앱 달력 주(일요일 시작). YYYY-MM-DD 그대로 계산해 기기 시간대·DST·표시 언어와 무관하다.
 * 주차는 그 주가 시작한 달 기준이다 (2027-01-01 → 2026-12-27 시작, 12월 4주차).
 */
export function getCalendarWeek(dateKey: string): CalendarWeek {
  const startDateKey = addDaysToDateKey(dateKey, -getDayOfWeek(dateKey));
  return {
    startDateKey,
    endDateKey: addDaysToDateKey(startDateKey, DAYS_PER_WEEK - 1),
    weekOfMonth: Math.ceil(parseDateKey(startDateKey).date() / DAYS_PER_WEEK),
  };
}
