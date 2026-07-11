import dayjs from "dayjs";

/**
 * 날짜가 현재 시각 기준으로 만료되었는지 확인
 *
 * 세션, 토큰, 인증코드 등의 만료 검사에 사용합니다.
 *
 * @example isExpired(pastDate)   // true
 * @example isExpired(futureDate) // false
 */
export function isExpired(date: Date): boolean {
	return dayjs.utc(date).isBefore(dayjs.utc());
}

/** date가 compare보다 이전인지 확인 */
export function isBefore(date: Date, compare: Date): boolean {
	return dayjs.utc(date).isBefore(dayjs.utc(compare));
}

/** date가 compare보다 이후인지 확인 */
export function isAfter(date: Date, compare: Date): boolean {
	return dayjs.utc(date).isAfter(dayjs.utc(compare));
}

/** 두 날짜가 동일한 시각인지 확인 (밀리초 단위) */
export function isSame(date: Date, compare: Date): boolean {
	return dayjs.utc(date).isSame(dayjs.utc(compare));
}

/** 두 날짜가 같은 날인지 확인 (시간 무시) */
export function isSameDay(date: Date, compare: Date): boolean {
	return dayjs.utc(date).isSame(dayjs.utc(compare), "day");
}

/** 두 날짜 사이의 일수 차이 (date - compare) */
export function diffInDays(date: Date, compare: Date): number {
	return dayjs.utc(date).diff(dayjs.utc(compare), "day");
}

/** 두 날짜 사이의 초 차이 (date - compare) */
export function diffInSeconds(date: Date, compare: Date): number {
	return dayjs.utc(date).diff(dayjs.utc(compare), "second");
}
