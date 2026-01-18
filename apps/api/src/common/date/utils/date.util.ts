import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { DATE_FORMAT, type DateFormatType } from "../constants";

dayjs.extend(utc);

// ============================================
// 현재 시각
// ============================================

/**
 * 현재 시각을 UTC Date 객체로 반환
 */
export function now(): Date {
	return dayjs.utc().toDate();
}

/**
 * 현재 시각의 Unix timestamp(밀리초) 반환
 */
export function timestamp(): number {
	return dayjs.utc().valueOf();
}

// ============================================
// 파싱
// ============================================

/**
 * 날짜 문자열을 UTC Date 객체로 파싱
 */
export function parseDate(dateString: string): Date {
	return dayjs.utc(dateString).toDate();
}

/**
 * 날짜 문자열을 UTC Date 객체로 파싱 (parseDate의 별칭)
 */
export function toDate(dateString: string): Date {
	return dayjs.utc(dateString).toDate();
}

// ============================================
// 포맷팅
// ============================================

/**
 * Date 객체를 ISO 8601 문자열로 변환
 * @example toISOString(date) // "2024-01-15T09:30:00.000Z"
 */
export function toISOString(date: Date): string {
	return dayjs.utc(date).toISOString();
}

/**
 * Date 객체를 날짜만 문자열로 변환 (YYYY-MM-DD)
 * @example toDateString(date) // "2024-01-15"
 */
export function toDateString(date: Date): string {
	return dayjs.utc(date).format(DATE_FORMAT.DATE_ONLY);
}

/**
 * Date 객체를 지정된 포맷으로 변환
 * @example format(date, "YYYY-MM-DD") // "2024-01-15"
 * @example format(date, "YYYY-MM") // "2024-01"
 */
export function format(date: Date, formatStr: DateFormatType | string): string {
	return dayjs.utc(date).format(formatStr);
}

/**
 * Date 객체 또는 null을 ISO 문자열 또는 null로 변환
 * @example toISOStringOrNull(date) // "2024-01-15T09:30:00.000Z"
 * @example toISOStringOrNull(null) // null
 */
export function toISOStringOrNull(date: Date | null): string | null {
	return date ? dayjs.utc(date).toISOString() : null;
}

/**
 * Date 객체 또는 null을 날짜 문자열 또는 null로 변환
 * @example toDateStringOrNull(date) // "2024-01-15"
 * @example toDateStringOrNull(null) // null
 */
export function toDateStringOrNull(date: Date | null): string | null {
	return date ? dayjs.utc(date).format(DATE_FORMAT.DATE_ONLY) : null;
}

// ============================================
// 시간 연산
// ============================================

/**
 * 지정된 초 후의 시각 반환
 */
export function addSeconds(seconds: number, from: Date = now()): Date {
	return dayjs.utc(from).add(seconds, "second").toDate();
}

/**
 * 지정된 분 후의 시각 반환
 */
export function addMinutes(minutes: number, from: Date = now()): Date {
	return dayjs.utc(from).add(minutes, "minute").toDate();
}

/**
 * 지정된 시간 후의 시각 반환
 */
export function addHours(hours: number, from: Date = now()): Date {
	return dayjs.utc(from).add(hours, "hour").toDate();
}

/**
 * 지정된 일 후의 시각 반환
 */
export function addDays(days: number, from: Date = now()): Date {
	return dayjs.utc(from).add(days, "day").toDate();
}

/**
 * 지정된 초 전의 시각 반환
 */
export function subtractSeconds(seconds: number, from: Date = now()): Date {
	return dayjs.utc(from).subtract(seconds, "second").toDate();
}

/**
 * 지정된 분 전의 시각 반환
 */
export function subtractMinutes(minutes: number, from: Date = now()): Date {
	return dayjs.utc(from).subtract(minutes, "minute").toDate();
}

/**
 * 지정된 일 전의 시각 반환
 */
export function subtractDays(days: number, from: Date = now()): Date {
	return dayjs.utc(from).subtract(days, "day").toDate();
}

/**
 * 밀리초를 Date에 더하기
 */
export function addMilliseconds(ms: number, from: Date = now()): Date {
	return dayjs.utc(from).add(ms, "millisecond").toDate();
}

// ============================================
// 비교
// ============================================

/**
 * 날짜가 현재 시각보다 이전인지 확인 (만료 체크)
 */
export function isExpired(date: Date): boolean {
	return dayjs.utc(date).isBefore(dayjs.utc());
}

/**
 * date가 compare보다 이전인지 확인
 */
export function isBefore(date: Date, compare: Date): boolean {
	return dayjs.utc(date).isBefore(dayjs.utc(compare));
}

/**
 * date가 compare보다 이후인지 확인
 */
export function isAfter(date: Date, compare: Date): boolean {
	return dayjs.utc(date).isAfter(dayjs.utc(compare));
}

/**
 * 두 날짜가 같은지 확인
 */
export function isSame(date: Date, compare: Date): boolean {
	return dayjs.utc(date).isSame(dayjs.utc(compare));
}

/**
 * 두 날짜가 같은 날인지 확인 (시간 무시)
 */
export function isSameDay(date: Date, compare: Date): boolean {
	return dayjs.utc(date).isSame(dayjs.utc(compare), "day");
}

// ============================================
// 날짜 범위
// ============================================

/**
 * 해당 날짜의 시작 시각(00:00:00.000) 반환
 */
export function startOfDay(date: Date = now()): Date {
	return dayjs.utc(date).startOf("day").toDate();
}

/**
 * 해당 날짜의 끝 시각(23:59:59.999) 반환
 */
export function endOfDay(date: Date = now()): Date {
	return dayjs.utc(date).endOf("day").toDate();
}

/**
 * 해당 월의 시작 시각 반환
 */
export function startOfMonth(date: Date = now()): Date {
	return dayjs.utc(date).startOf("month").toDate();
}

/**
 * 해당 월의 끝 시각 반환
 */
export function endOfMonth(date: Date = now()): Date {
	return dayjs.utc(date).endOf("month").toDate();
}

// ============================================
// 편의 함수
// ============================================

/**
 * 날짜가 유효한지 확인
 */
export function isValidDate(date: unknown): date is Date {
	return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * 문자열이 유효한 날짜인지 확인
 */
export function isValidDateString(dateString: string): boolean {
	return dayjs(dateString).isValid();
}

/**
 * 두 날짜 사이의 일수 차이 반환
 */
export function diffInDays(date: Date, compare: Date): number {
	return dayjs.utc(date).diff(dayjs.utc(compare), "day");
}

/**
 * 두 날짜 사이의 초 차이 반환
 */
export function diffInSeconds(date: Date, compare: Date): number {
	return dayjs.utc(date).diff(dayjs.utc(compare), "second");
}
