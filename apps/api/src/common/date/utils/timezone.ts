import dayjs from "dayjs";
import { now } from "./core";

const DEFAULT_TIMEZONE = "UTC";

/**
 * 지정 타임존 기준 "오늘" 날짜를 UTC midnight Date로 반환
 *
 * 사용자의 로컬 타임존에서 "오늘"이 무슨 날짜인지 확인할 때 사용합니다.
 * 반환값은 해당 날짜의 UTC 자정(00:00:00.000Z)입니다.
 *
 * @example todayInTimezone("Asia/Seoul")      // KST 기준 오늘 → UTC midnight
 * @example todayInTimezone("America/New_York") // EST 기준 오늘 → UTC midnight
 */
export function todayInTimezone(tz: string = DEFAULT_TIMEZONE): Date {
	const localDateStr = dayjs().tz(tz).format("YYYY-MM-DD");
	return dayjs.utc(localDateStr).startOf("day").toDate();
}

/**
 * 로컬 날짜 + 시간 문자열을 UTC Date로 변환
 *
 * 사용자가 입력한 로컬 시간(날짜 + HH:mm)을 서버 저장용 UTC로 변환합니다.
 * Google Calendar 패턴: 시간 이벤트를 TIMESTAMPTZ(UTC)로 저장.
 *
 * @example parseLocalDateTime("2026-01-15", "14:00", "Asia/Seoul")      → 2026-01-15T05:00:00.000Z
 * @example parseLocalDateTime("2026-01-15", "14:00", "America/New_York") → 2026-01-15T19:00:00.000Z
 */
export function parseLocalDateTime(
	dateStr: string,
	timeStr: string,
	tz: string = DEFAULT_TIMEZONE,
): Date {
	return dayjs.tz(`${dateStr}T${timeStr}:00`, tz).utc().toDate();
}

/**
 * 지정 타임존에서 특정 시점의 날짜를 UTC midnight Date로 반환
 *
 * PostgreSQL DATE(@db.Date) 컬럼과 비교할 때 사용합니다.
 *
 * @example startOfDayInTimezone(new Date('2026-02-06T20:00:00Z'), 'Asia/Seoul')
 *   // KST 2/7 → 2026-02-07T00:00:00.000Z
 */
export function startOfDayInTimezone(
	date: Date = now(),
	tz: string = DEFAULT_TIMEZONE,
): Date {
	const localDateStr = dayjs(date).tz(tz).format("YYYY-MM-DD");
	return dayjs.utc(localDateStr).startOf("day").toDate();
}

/**
 * 지정 타임존의 자정을 실제 UTC timestamp로 반환
 *
 * TIMESTAMPTZ 컬럼 범위 쿼리에 사용합니다. (tz 자정 = UTC 오프셋 적용)
 *
 * @example midnightInTimezone(new Date('2026-02-11T00:00:00+09:00'), 'Asia/Seoul')
 *   // KST 2/11 자정 → 2026-02-10T15:00:00.000Z
 */
export function midnightInTimezone(
	date: Date = now(),
	tz: string = DEFAULT_TIMEZONE,
): Date {
	return dayjs(date).tz(tz).startOf("day").utc().toDate();
}
