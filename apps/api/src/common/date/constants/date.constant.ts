/**
 * 날짜 포맷 상수
 */
export const DATE_FORMAT = {
	/** YYYY-MM-DD (예: 2026-01-17) */
	DATE_ONLY: "YYYY-MM-DD",
	/** YYYY-MM-DD HH:mm:ss (예: 2026-01-17 14:30:00) */
	DATE_TIME: "YYYY-MM-DD HH:mm:ss",
	/** YYYY-MM (예: 2026-01) */
	YEAR_MONTH: "YYYY-MM",
	/** YYYYMMDD (예: 20260117) — 공공데이터포털 API용 */
	DATE_COMPACT: "YYYYMMDD",
	/** YYYYMMDDHH (예: 2026011714) — 공공데이터포털 API용 */
	DATE_HOUR_COMPACT: "YYYYMMDDHH",
} as const;

export type DateFormatType = (typeof DATE_FORMAT)[keyof typeof DATE_FORMAT];

/**
 * 시간 단위 밀리초 변환 상수
 */
export const TIME_UNIT = {
	/** 1초 = 1,000ms */
	MS_PER_SECOND: 1_000,
	/** 1분 = 60,000ms */
	MS_PER_MINUTE: 60_000,
	/** 1시간 = 3,600,000ms */
	MS_PER_HOUR: 3_600_000,
} as const;
