import dayjs from "dayjs";
import { now } from "./core";

/** 해당 날짜의 시작 시각 (00:00:00.000) */
export function startOfDay(date: Date = now()): Date {
	return dayjs.utc(date).startOf("day").toDate();
}

/** 해당 날짜의 끝 시각 (23:59:59.999) */
export function endOfDay(date: Date = now()): Date {
	return dayjs.utc(date).endOf("day").toDate();
}

/** 해당 월의 시작 시각 */
export function startOfMonth(date: Date = now()): Date {
	return dayjs.utc(date).startOf("month").toDate();
}

/** 해당 월의 끝 시각 */
export function endOfMonth(date: Date = now()): Date {
	return dayjs.utc(date).endOf("month").toDate();
}
