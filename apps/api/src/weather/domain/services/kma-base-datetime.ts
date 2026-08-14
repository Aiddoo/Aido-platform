import { toCompactDateString } from "@/shared/domain/date/utils/format";

/**
 * 단기예보 발표 시각 (Base Time)
 * 하루 8회: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
 * API 제공 시간은 발표 시각 + 약 10분 이후
 */
const KMA_BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"] as const;

/** 기상청 API base_date + base_time 쌍 */
export interface KmaBaseDateTime {
	baseDate: string; // YYYYMMDD
	baseTime: string; // HHmm
}

/**
 * 주어진 시각 기준으로 가장 최근 발표 base_date + base_time을 반환한다 (순수 시간 정책).
 *
 * - 안전 마진 +15분 (공식 +10분이지만 실무에서 지연 빈번)
 * - 자정~02:14: 전날 23시 발표 → base_date도 하루 전으로 보정
 */
export function getKmaBaseDateTime(date: Date): KmaBaseDateTime {
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const currentTime = hours * 100 + minutes;

	const availableTimes = KMA_BASE_TIMES.filter((bt) => {
		const btNum = Number.parseInt(bt, 10);
		return currentTime >= btNum + 15;
	});

	if (availableTimes.length === 0) {
		// 자정~02:14: 전날 23시 발표 데이터 → base_date도 하루 전
		const yesterday = new Date(date);
		yesterday.setDate(yesterday.getDate() - 1);
		return {
			baseDate: toCompactDateString(yesterday),
			baseTime: "2300",
		};
	}

	return {
		baseDate: toCompactDateString(date),
		baseTime: availableTimes.at(-1) ?? "2300",
	};
}
