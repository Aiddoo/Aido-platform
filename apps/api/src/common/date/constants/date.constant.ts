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
} as const;

export type DateFormatType = (typeof DATE_FORMAT)[keyof typeof DATE_FORMAT];
