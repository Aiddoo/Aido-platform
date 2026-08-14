import dayjs from "dayjs";

import { now } from "./core";

/** 지정 분 후의 시각 반환 */
export function addMinutes(minutes: number, from: Date = now()): Date {
	return dayjs.utc(from).add(minutes, "minute").toDate();
}

/** 지정 일 후의 시각 반환 */
export function addDays(days: number, from: Date = now()): Date {
	return dayjs.utc(from).add(days, "day").toDate();
}

/** 지정 개월 후의 시각 반환 */
export function addMonths(months: number, from: Date = now()): Date {
	return dayjs.utc(from).add(months, "month").toDate();
}

/** 지정 밀리초 후의 시각 반환 */
export function addMilliseconds(ms: number, from: Date = now()): Date {
	return dayjs.utc(from).add(ms, "millisecond").toDate();
}

/** 지정 분 전의 시각 반환 */
export function subtractMinutes(minutes: number, from: Date = now()): Date {
	return dayjs.utc(from).subtract(minutes, "minute").toDate();
}

/** 지정 초 전의 시각 반환 */
export function subtractSeconds(seconds: number, from: Date = now()): Date {
	return dayjs.utc(from).subtract(seconds, "second").toDate();
}

/** 지정 일 전의 시각 반환 */
export function subtractDays(days: number, from: Date = now()): Date {
	return dayjs.utc(from).subtract(days, "day").toDate();
}

/** 지정 밀리초 전의 시각 반환 */
export function subtractMilliseconds(ms: number, from: Date = now()): Date {
	return dayjs.utc(from).subtract(ms, "millisecond").toDate();
}

/** 지정 개월 전의 시각 반환 */
export function subtractMonths(months: number, from: Date = now()): Date {
	return dayjs.utc(from).subtract(months, "month").toDate();
}
