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
 * ISO 주번호 식별자 (예: "2026-W10")
 *
 * BullMQ jobId 중복 방지용으로 사용합니다.
 * @example toIsoWeekId(new Date("2026-03-04")) // "2026-W10"
 */
export function toIsoWeekId(date: Date = new Date()): string {
	const d = dayjs.utc(date);
	return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, "0")}`;
}
