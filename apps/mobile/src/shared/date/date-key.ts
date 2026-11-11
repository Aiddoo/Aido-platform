import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';

// Hinnant의 civil 날짜 ↔ 일수 변환(proleptic 그레고리력)이다. Hermes에 Temporal이 없고 폴리필은 spike에서 버렸다
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS_PER_YEAR = 12;
const FEBRUARY = 2;
const LEAP_FEBRUARY_DAYS = 29;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const DAYS_PER_ERA = 146_097;
const YEARS_PER_ERA = 400;
// 0000-03-01부터 1970-01-01까지의 일수. 3월을 해의 첫 달로 세면 윤일이 해의 끝에 온다
const EPOCH_SHIFT_DAYS = 719_468;
// 1970-01-01은 목요일이다
const EPOCH_DAY_OF_WEEK = 4;
const ISO_WEEK_THURSDAY_OFFSET = 3;

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number): number {
  if (month === FEBRUARY && isLeapYear(year)) {
    return LEAP_FEBRUARY_DAYS;
  }
  return DAYS_IN_MONTH[month - 1] ?? Number.NaN;
}

/** 계약의 `YYYY-MM-DD`(`z.iso.date()`)만 읽는다. 없는 날(2월 30일)도 null이다 */
export function parseDateKey(dateKey: string): CivilDate | null {
  const parts = DATE_KEY_PATTERN.exec(dateKey);
  if (parts == null) {
    return null;
  }
  const [, yearText, monthText, dayText] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const isRealDate =
    1 <= month && month <= MONTHS_PER_YEAR && 1 <= day && day <= getDaysInMonth(year, month);
  return isRealDate ? { year, month, day } : null;
}

function toEpochDay({ year, month, day }: CivilDate): number {
  const marchYear = month <= FEBRUARY ? year - 1 : year;
  const era = Math.floor(marchYear / YEARS_PER_ERA);
  const yearOfEra = marchYear - era * YEARS_PER_ERA;
  const marchMonth = month > FEBRUARY ? month - 3 : month + 9;
  const dayOfYear = Math.floor((153 * marchMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * DAYS_PER_ERA + dayOfEra - EPOCH_SHIFT_DAYS;
}

function toCivilDate(epochDay: number): CivilDate {
  const shifted = epochDay + EPOCH_SHIFT_DAYS;
  const era = Math.floor(shifted / DAYS_PER_ERA);
  const dayOfEra = shifted - era * DAYS_PER_ERA;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / (DAYS_PER_ERA - 1))) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const marchMonth = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * marchMonth + 2) / 5) + 1;
  const month = marchMonth < 10 ? marchMonth + 3 : marchMonth - 9;
  const year = yearOfEra + era * YEARS_PER_ERA + (month <= FEBRUARY ? 1 : 0);
  return { year, month, day };
}

/** 0=일 … 6=토 */
function getWeekday(epochDay: number): number {
  return (((epochDay + EPOCH_DAY_OF_WEEK) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

/** 월요일 시작 주의 월요일까지 지난 일수 */
function getDaysSinceMonday(epochDay: number): number {
  return (getWeekday(epochDay) + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
}

/** 잘못된 key에서 나온 날짜는 빈 문자열이다 */
function formatDateKey(date: CivilDate | null): string {
  if (date == null) {
    return '';
  }
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${String(date.year).padStart(4, '0')}-${month}-${day}`;
}

function shiftDateKey(dateKey: string, toEpochDayShift: (epochDay: number) => number): string {
  const date = parseDateKey(dateKey);
  return date == null ? '' : formatDateKey(toCivilDate(toEpochDayShift(toEpochDay(date))));
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  return shiftDateKey(dateKey, (epochDay) => epochDay + days);
}

/** 말일을 넘기면 그 달의 마지막 날로 맞춘다 */
export function addMonthsToDateKey(dateKey: string, months: number): string {
  const date = parseDateKey(dateKey);
  if (date == null) {
    return '';
  }
  const monthIndex = date.year * MONTHS_PER_YEAR + (date.month - 1) + months;
  const year = Math.floor(monthIndex / MONTHS_PER_YEAR);
  const month = monthIndex - year * MONTHS_PER_YEAR + 1;
  return formatDateKey({ year, month, day: Math.min(date.day, getDaysInMonth(year, month)) });
}

export function getMonthStartDateKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return formatDateKey(date == null ? null : { ...date, day: 1 });
}

/** 두 YYYY-MM-DD의 달 차이 (to - from). 일은 보지 않고 달만 센다. */
export function diffDateKeysInMonths(from: string, to: string): number {
  const fromDate = parseDateKey(from);
  const toDate = parseDateKey(to);
  if (fromDate == null || toDate == null) {
    return Number.NaN;
  }
  return (toDate.year - fromDate.year) * MONTHS_PER_YEAR + (toDate.month - fromDate.month);
}

/** 두 YYYY-MM-DD 사이의 달력 일수 (to - from, 시간대·DST 무관). */
export function diffDateKeysInDays(from: string, to: string): number {
  const fromDate = parseDateKey(from);
  const toDate = parseDateKey(to);
  if (fromDate == null || toDate == null) {
    return Number.NaN;
  }
  return toEpochDay(toDate) - toEpochDay(fromDate);
}

/** YYYY-MM-DD의 요일 (0=일 … 6=토, Date#getDay()와 같은 인덱스). */
export function getDayOfWeek(dateKey: string): number {
  const date = parseDateKey(dateKey);
  return date == null ? Number.NaN : getWeekday(toEpochDay(date));
}

/** 그 날이 속한 월요일 시작 주의 월요일. 일요일은 앞선 월요일로 간다. */
export function getMondayOfDateKey(dateKey: string): string {
  return shiftDateKey(dateKey, (epochDay) => epochDay - getDaysSinceMonday(epochDay));
}

export function getYearOfDateKey(dateKey: string): number {
  return parseDateKey(dateKey)?.year ?? Number.NaN;
}

export function getDayOfMonth(dateKey: string): number {
  return parseDateKey(dateKey)?.day ?? Number.NaN;
}

/** 그 날이 속한 ISO 주(월요일 시작)의 연도. 연말·연초에는 달력 연도와 다르다 (2027-01-01 → 2026). */
export function getIsoWeekYear(dateKey: string): number {
  const date = parseDateKey(dateKey);
  if (date == null) {
    return Number.NaN;
  }
  const epochDay = toEpochDay(date);
  // ISO 주의 연도는 그 주 목요일이 속한 해다
  return toCivilDate(epochDay - getDaysSinceMonday(epochDay) + ISO_WEEK_THURSDAY_OFFSET).year;
}

export function getDaysInDateKeyMonth(dateKey: string): number {
  const date = parseDateKey(dateKey);
  return date == null ? Number.NaN : getDaysInMonth(date.year, date.month);
}

export function getMonthEndDateKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return formatDateKey(
    date == null ? null : { ...date, day: getDaysInMonth(date.year, date.month) },
  );
}

export function isSameMonthDateKey(first: string, second: string): boolean {
  const firstDate = parseDateKey(first);
  const secondDate = parseDateKey(second);
  return (
    firstDate != null &&
    secondDate != null &&
    firstDate.year === secondDate.year &&
    firstDate.month === secondDate.month
  );
}

export function isSameYearDateKey(first: string, second: string): boolean {
  const firstDate = parseDateKey(first);
  const secondDate = parseDateKey(second);
  return firstDate != null && secondDate != null && firstDate.year === secondDate.year;
}

/** 서버 주차 라벨과 같은 규칙이다. 주의 목요일이 속한 달의 몇 번째 목요일인지가 주차다 */
export function getIsoWeekOfMonth(dateKey: string): {
  thursdayDateKey: string;
  weekOfMonth: number;
} {
  const thursdayDateKey = addDaysToDateKey(getMondayOfDateKey(dateKey), ISO_WEEK_THURSDAY_OFFSET);
  return {
    thursdayDateKey,
    weekOfMonth: Math.ceil(getDayOfMonth(thursdayDateKey) / DAYS_PER_WEEK),
  };
}

export interface CalendarWeek {
  startDateKey: string;
  endDateKey: string;
  weekOfMonth: number;
}

/** 주차는 그 주가 시작한 달 기준이다 (2027-01-01 → 2026-12-27 시작, 12월 4주차) */
export function getCalendarWeek(dateKey: string): CalendarWeek {
  const startDateKey = addDaysToDateKey(dateKey, -getDayOfWeek(dateKey));
  return {
    startDateKey,
    endDateKey: addDaysToDateKey(startDateKey, DAYS_PER_WEEK - 1),
    weekOfMonth: Math.ceil(getDayOfMonth(startDateKey) / DAYS_PER_WEEK),
  };
}
