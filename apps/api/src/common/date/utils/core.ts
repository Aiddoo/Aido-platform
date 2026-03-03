import dayjs from "dayjs";

/**
 * 현재 시각을 UTC Date 객체로 반환
 */
export function now(): Date {
	return dayjs.utc().toDate();
}
