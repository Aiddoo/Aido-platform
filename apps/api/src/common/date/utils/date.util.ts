import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

/**
 * 현재 시각을 UTC로 반환
 */
export function now(): Date {
	return dayjs.utc().toDate();
}

/**
 * 날짜 문자열을 Date 객체로 파싱 (UTC)
 */
export function parseDate(dateString: string): Date {
	return dayjs.utc(dateString).toDate();
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
 * 지정된 일 전의 시각 반환
 */
export function subtractDays(days: number, from: Date = now()): Date {
	return dayjs.utc(from).subtract(days, "day").toDate();
}

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
