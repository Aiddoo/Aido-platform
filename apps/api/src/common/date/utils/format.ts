import dayjs from "dayjs";
import { DATE_FORMAT } from "../constants/date.constant";

/**
 * Date → ISO 8601 문자열
 * @example toISOString(date) // "2024-01-15T09:30:00.000Z"
 */
export function toISOString(date: Date): string {
	return dayjs.utc(date).toISOString();
}

/**
 * Date → 날짜 문자열 (YYYY-MM-DD)
 * @example toDateString(date) // "2024-01-15"
 */
export function toDateString(date: Date): string {
	return dayjs.utc(date).format(DATE_FORMAT.DATE_ONLY);
}

/**
 * Date | null → ISO 문자열 | null
 * @example toISOStringOrNull(date) // "2024-01-15T09:30:00.000Z"
 * @example toISOStringOrNull(null) // null
 */
export function toISOStringOrNull(date: Date | null): string | null {
	return date ? dayjs.utc(date).toISOString() : null;
}

/**
 * Date | null → 날짜 문자열 | null
 * @example toDateStringOrNull(date) // "2024-01-15"
 * @example toDateStringOrNull(null) // null
 */
export function toDateStringOrNull(date: Date | null): string | null {
	return date ? dayjs.utc(date).format(DATE_FORMAT.DATE_ONLY) : null;
}

/**
 * Date → 공공데이터포털 API 날짜 (YYYYMMDD)
 *
 * 로컬 타임존(서버 TZ=Asia/Seoul) 기준으로 변환합니다.
 * 기상청, 천문연구원, 에어코리아 등 공공 API 호출용.
 *
 * @example toCompactDateString(new Date(2026, 2, 18)) // "20260318"
 */
export function toCompactDateString(date: Date): string {
	return dayjs(date).format(DATE_FORMAT.DATE_COMPACT);
}

/**
 * Date → 공공데이터포털 API 날짜+시간 (YYYYMMDDHH)
 *
 * 로컬 타임존(서버 TZ=Asia/Seoul) 기준으로 변환합니다.
 * 기상청 생활기상지수 API 등 시간 단위 API 호출용.
 *
 * @example toCompactDateHourString(new Date(2026, 2, 18, 14, 30)) // "2026031814"
 */
export function toCompactDateHourString(date: Date): string {
	return dayjs(date).format(DATE_FORMAT.DATE_HOUR_COMPACT);
}

/**
 * ISO 주번호 식별자 (예: "2026-W10")
 *
 * BullMQ jobId 중복 방지용으로 사용합니다.
 * tz를 전달하면 해당 타임존 기준으로 주차를 계산합니다.
 *
 * @example toIsoWeekId(new Date("2026-03-04"))                    // "2026-W10" (UTC)
 * @example toIsoWeekId(new Date("2026-03-15T16:00:00Z"), "Asia/Seoul") // "2026-W12" (KST 3/16 월)
 */
export function toIsoWeekId(date: Date = new Date(), tz?: string): string {
	const d = tz ? dayjs(date).tz(tz) : dayjs.utc(date);
	return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, "0")}`;
}

/**
 * ISO 월 식별자 (예: "2026-M03")
 *
 * 월간 리포트 BullMQ jobId 중복 방지용으로 사용합니다.
 * tz를 전달하면 해당 타임존 기준으로 월을 계산합니다.
 *
 * @example toIsoMonthId(new Date("2026-03-08"))                    // "2026-M03" (UTC)
 * @example toIsoMonthId(new Date("2026-03-31T16:00:00Z"), "Asia/Seoul") // "2026-M04" (KST 4/1)
 */
export function toIsoMonthId(date: Date = new Date(), tz?: string): string {
	const d = tz ? dayjs(date).tz(tz) : dayjs.utc(date);
	return `${d.year()}-M${String(d.month() + 1).padStart(2, "0")}`;
}
