import { NIGHT_TIME_CONFIG } from "@aido/validators";
import dayjs from "dayjs";

import { resolveTimezone } from "@/shared/domain/date/utils/timezone";

/**
 * 사용자 타임존 기준 야간 시간대 확인 (로컬 21:00-08:00)
 *
 * @param tz IANA 타임존 (기본값: "UTC")
 * @param date 확인할 시간 (기본값: 현재 시간)
 * @returns 야간 시간대 여부
 */
export function isNightTime(tz: string = "UTC", date: Date = new Date()): boolean {
	const localHour = dayjs(date).tz(resolveTimezone(tz)).hour();
	return localHour >= NIGHT_TIME_CONFIG.START_HOUR || localHour < NIGHT_TIME_CONFIG.END_HOUR;
}
