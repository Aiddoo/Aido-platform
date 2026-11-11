import { dateSchema } from '@aido/api/common';
import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import { z } from 'zod';

// Hinnant의 civil 날짜 ↔ 일수 변환(proleptic 그레고리력, "chrono-Compatible Low-Level Date Algorithms")이다.
// Hermes에 Temporal이 없고 폴리필은 spike에서 버렸다. 3월을 해의 첫 달로 세면 윤일이 해의 끝에 와 식이 단순해진다
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS_PER_YEAR = 12;
const FEBRUARY = 2;
const MARCH = 3;
const LEAP_FEBRUARY_DAYS = 29;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const YEARS_PER_LEAP_CYCLE = 4;
const YEARS_PER_CENTURY = 100;
// 그레고리력은 400년마다 요일과 윤년이 똑같이 되풀이된다
const YEARS_PER_ERA = 400;
const DAYS_PER_COMMON_YEAR = 365;
const DAYS_PER_4_COMMON_YEARS = 1460;
const DAYS_PER_CENTURY = 36_524;
const DAYS_PER_ERA = 146_097;
// 3월부터 7월까지 다섯 달이 153일이고 이 길이 패턴이 되풀이돼, 3월 기준 달과 그 앞의 일수를 한 식으로 오간다
const MARCH_TO_JULY_DAYS = 153;
const MARCH_TO_JULY_MONTHS = 5;
const MONTH_LENGTH_ROUNDING = 2;
// 0000-03-01부터 1970-01-01까지의 일수
const EPOCH_SHIFT_DAYS = 719_468;
// 1970-01-01은 목요일이다
const EPOCH_DAY_OF_WEEK = 4;
const ISO_WEEK_THURSDAY_OFFSET = 3;

/** 시간대와 무관한 달력 날짜(계약 `YYYY-MM-DD`). 없는 날(2월 30일)은 받지 않는다 */
export const dateKeySchema = dateSchema.brand<'DateKey'>();
export type DateKey = z.infer<typeof dateKeySchema>;

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

function isLeapYear(year: number): boolean {
  return (
    (year % YEARS_PER_LEAP_CYCLE === 0 && year % YEARS_PER_CENTURY !== 0) ||
    year % YEARS_PER_ERA === 0
  );
}

function getDaysInMonth(year: number, month: number): number {
  if (month === FEBRUARY && isLeapYear(year)) {
    return LEAP_FEBRUARY_DAYS;
  }
  return DAYS_IN_MONTH[month - 1] ?? Number.NaN;
}

/** `dateKeySchema`와 같은 규칙이다. 계산 결과를 Zod 없이 좁혀 달력 칸마다 드는 비용을 줄인다 */
export function isDateKey(value: string): value is DateKey {
  const parts = DATE_KEY_PATTERN.exec(value);
  if (parts == null) {
    return false;
  }
  const [, yearText, monthText, dayText] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return 1 <= month && month <= MONTHS_PER_YEAR && 1 <= day && day <= getDaysInMonth(year, month);
}

/** 검증 안 된 바깥 문자열(위젯 명령·딥링크)을 날짜 key로 읽는다. 아니면 null이다 */
export function parseDateKey(value: string): DateKey | null {
  return isDateKey(value) ? value : null;
}

/** brand는 입력 타입에 남지 않아 폼과 폼이 같이 쓰는 스키마는 이것을 쓴다 */
export const dateKeyFieldSchema = z.custom<DateKey>(
  (value) => typeof value === 'string' && isDateKey(value),
);

/** 날짜 key는 형식을 지난 값이라 자리만 잘라 읽는다 */
export function toCivilDate(dateKey: DateKey): CivilDate {
  return {
    year: Number(dateKey.slice(0, 4)),
    month: Number(dateKey.slice(5, 7)),
    day: Number(dateKey.slice(8, 10)),
  };
}

function formatDateKey(date: CivilDate): DateKey {
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  const dateKey = `${String(date.year).padStart(4, '0')}-${month}-${day}`;
  // 0000~9999년을 벗어난 계산 결과는 계약 형식이 아니다
  if (!isDateKey(dateKey)) {
    throw new RangeError(`날짜 key로 쓸 수 없는 날짜다: ${dateKey}`);
  }
  return dateKey;
}

/** 3월=0 … 2월=11 */
function toMarchBasedMonth(month: number): number {
  return (month - MARCH + MONTHS_PER_YEAR) % MONTHS_PER_YEAR;
}

function fromMarchBasedMonth(marchBasedMonth: number): number {
  return ((marchBasedMonth + MARCH - 1) % MONTHS_PER_YEAR) + 1;
}

/** 3월 1일부터 그 달 1일 앞까지의 일수 */
function getDaysBeforeMarchBasedMonth(marchBasedMonth: number): number {
  return Math.floor(
    (MARCH_TO_JULY_DAYS * marchBasedMonth + MONTH_LENGTH_ROUNDING) / MARCH_TO_JULY_MONTHS,
  );
}

/** 3월 1일부터 센 일수가 속한 3월 기준 달 */
function toMarchBasedMonthOfYearDay(dayOfYear: number): number {
  return Math.floor(
    (MARCH_TO_JULY_MONTHS * dayOfYear + MONTH_LENGTH_ROUNDING) / MARCH_TO_JULY_DAYS,
  );
}

/** 400년 주기 안에서 그 해 3월 1일 앞까지의 일수 */
function getDaysBeforeYearOfEra(yearOfEra: number): number {
  return (
    yearOfEra * DAYS_PER_COMMON_YEAR +
    Math.floor(yearOfEra / YEARS_PER_LEAP_CYCLE) -
    Math.floor(yearOfEra / YEARS_PER_CENTURY)
  );
}

/** 400년 주기 안의 일수가 속한 해. 윤일을 빼 모든 해를 365일로 맞춘 뒤 나눈다 */
function toYearOfEra(dayOfEra: number): number {
  const leapDays =
    Math.floor(dayOfEra / DAYS_PER_4_COMMON_YEARS) -
    Math.floor(dayOfEra / DAYS_PER_CENTURY) +
    Math.floor(dayOfEra / (DAYS_PER_ERA - 1));
  return Math.floor((dayOfEra - leapDays) / DAYS_PER_COMMON_YEAR);
}

function toEpochDay(dateKey: DateKey): number {
  const { year, month, day } = toCivilDate(dateKey);
  const marchYear = month <= FEBRUARY ? year - 1 : year;
  const era = Math.floor(marchYear / YEARS_PER_ERA);
  const yearOfEra = marchYear - era * YEARS_PER_ERA;
  const dayOfYear = getDaysBeforeMarchBasedMonth(toMarchBasedMonth(month)) + day - 1;
  const dayOfEra = getDaysBeforeYearOfEra(yearOfEra) + dayOfYear;
  return era * DAYS_PER_ERA + dayOfEra - EPOCH_SHIFT_DAYS;
}

function fromEpochDay(epochDay: number): CivilDate {
  const shifted = epochDay + EPOCH_SHIFT_DAYS;
  const era = Math.floor(shifted / DAYS_PER_ERA);
  const dayOfEra = shifted - era * DAYS_PER_ERA;
  const yearOfEra = toYearOfEra(dayOfEra);
  const dayOfYear = dayOfEra - getDaysBeforeYearOfEra(yearOfEra);
  const marchBasedMonth = toMarchBasedMonthOfYearDay(dayOfYear);
  const day = dayOfYear - getDaysBeforeMarchBasedMonth(marchBasedMonth) + 1;
  const month = fromMarchBasedMonth(marchBasedMonth);
  const year = yearOfEra + era * YEARS_PER_ERA + (month <= FEBRUARY ? 1 : 0);
  return { year, month, day };
}

/** 0=일 … 6=토 */
function toDayOfWeek(epochDay: number): number {
  return (((epochDay + EPOCH_DAY_OF_WEEK) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

/** 월요일 시작 주의 월요일까지 지난 일수 */
function getDaysSinceMonday(epochDay: number): number {
  return (toDayOfWeek(epochDay) + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
}

export function addDaysToDateKey(dateKey: DateKey, days: number): DateKey {
  return formatDateKey(fromEpochDay(toEpochDay(dateKey) + days));
}

/** 말일을 넘기면 그 달의 마지막 날로 맞춘다 */
export function addMonthsToDateKey(dateKey: DateKey, months: number): DateKey {
  const date = toCivilDate(dateKey);
  const monthIndex = date.year * MONTHS_PER_YEAR + (date.month - 1) + months;
  const year = Math.floor(monthIndex / MONTHS_PER_YEAR);
  const month = monthIndex - year * MONTHS_PER_YEAR + 1;
  return formatDateKey({ year, month, day: Math.min(date.day, getDaysInMonth(year, month)) });
}

export function getMonthStartDateKey(dateKey: DateKey): DateKey {
  return formatDateKey({ ...toCivilDate(dateKey), day: 1 });
}

/** 두 YYYY-MM-DD의 달 차이 (to - from). 일은 보지 않고 달만 센다. */
export function diffDateKeysInMonths(from: DateKey, to: DateKey): number {
  const fromDate = toCivilDate(from);
  const toDate = toCivilDate(to);
  return (toDate.year - fromDate.year) * MONTHS_PER_YEAR + (toDate.month - fromDate.month);
}

/** 두 YYYY-MM-DD 사이의 달력 일수 (to - from, 시간대·DST 무관). */
export function diffDateKeysInDays(from: DateKey, to: DateKey): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** YYYY-MM-DD의 요일 (0=일 … 6=토, Date#getDay()와 같은 인덱스). */
export function getDayOfWeek(dateKey: DateKey): number {
  return toDayOfWeek(toEpochDay(dateKey));
}

/** 그 날이 속한 월요일 시작 주의 월요일. 일요일은 앞선 월요일로 간다. */
export function getMondayOfDateKey(dateKey: DateKey): DateKey {
  const epochDay = toEpochDay(dateKey);
  return formatDateKey(fromEpochDay(epochDay - getDaysSinceMonday(epochDay)));
}

export function getYearOfDateKey(dateKey: DateKey): number {
  return toCivilDate(dateKey).year;
}

export function getDayOfMonth(dateKey: DateKey): number {
  return toCivilDate(dateKey).day;
}

/** 그 날이 속한 ISO 주(월요일 시작)의 연도. 연말·연초에는 달력 연도와 다르다 (2027-01-01 → 2026). */
export function getIsoWeekYear(dateKey: DateKey): number {
  const epochDay = toEpochDay(dateKey);
  // ISO 주의 연도는 그 주 목요일이 속한 해다
  return fromEpochDay(epochDay - getDaysSinceMonday(epochDay) + ISO_WEEK_THURSDAY_OFFSET).year;
}

export function getDaysInDateKeyMonth(dateKey: DateKey): number {
  const date = toCivilDate(dateKey);
  return getDaysInMonth(date.year, date.month);
}

export function getMonthEndDateKey(dateKey: DateKey): DateKey {
  const date = toCivilDate(dateKey);
  return formatDateKey({ ...date, day: getDaysInMonth(date.year, date.month) });
}

export function isSameMonthDateKey(first: DateKey, second: DateKey): boolean {
  const firstDate = toCivilDate(first);
  const secondDate = toCivilDate(second);
  return firstDate.year === secondDate.year && firstDate.month === secondDate.month;
}

export function isSameYearDateKey(first: DateKey, second: DateKey): boolean {
  return getYearOfDateKey(first) === getYearOfDateKey(second);
}

/** 서버 주차 라벨과 같은 규칙이다. 주의 목요일이 속한 달의 몇 번째 목요일인지가 주차다 */
export function getIsoWeekOfMonth(dateKey: DateKey): {
  thursdayDateKey: DateKey;
  weekOfMonth: number;
} {
  const thursdayDateKey = addDaysToDateKey(getMondayOfDateKey(dateKey), ISO_WEEK_THURSDAY_OFFSET);
  return {
    thursdayDateKey,
    weekOfMonth: Math.ceil(getDayOfMonth(thursdayDateKey) / DAYS_PER_WEEK),
  };
}

export interface CalendarWeek {
  startDateKey: DateKey;
  endDateKey: DateKey;
  weekOfMonth: number;
}

/** 주차는 그 주가 시작한 달 기준이다 (2027-01-01 → 2026-12-27 시작, 12월 4주차) */
export function getCalendarWeek(dateKey: DateKey): CalendarWeek {
  const startDateKey = addDaysToDateKey(dateKey, -getDayOfWeek(dateKey));
  return {
    startDateKey,
    endDateKey: addDaysToDateKey(startDateKey, DAYS_PER_WEEK - 1),
    weekOfMonth: Math.ceil(getDayOfMonth(startDateKey) / DAYS_PER_WEEK),
  };
}
