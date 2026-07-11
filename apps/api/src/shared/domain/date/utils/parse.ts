import dayjs from "dayjs";

/**
 * 날짜 문자열을 UTC 자정(00:00:00.000Z) Date로 변환
 *
 * PostgreSQL DATE(@db.Date) 컬럼과 호환되는 형태로 파싱합니다.
 * 시간 정보는 제거되고 해당 날짜의 UTC 자정이 반환됩니다.
 *
 * @example parseDateOnly("2026-02-06") // 2026-02-06T00:00:00.000Z
 */
export function parseDateOnly(dateString: string): Date {
	return dayjs.utc(dateString).startOf("day").toDate();
}
