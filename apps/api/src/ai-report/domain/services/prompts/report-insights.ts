import type { SupportedLocale } from "@/shared/domain/locale";
import type { AggregatedReportData } from "../../types";

const DAY_KOREAN: Record<string, string> = {
	MON: "월요일",
	TUE: "화요일",
	WED: "수요일",
	THU: "목요일",
	FRI: "금요일",
	SAT: "토요일",
	SUN: "일요일",
};

const DAY_ENGLISH: Record<string, string> = {
	MON: "Monday",
	TUE: "Tuesday",
	WED: "Wednesday",
	THU: "Thursday",
	FRI: "Friday",
	SAT: "Saturday",
	SUN: "Sunday",
};

const WEEKDAYS = new Set(["MON", "TUE", "WED", "THU", "FRI"]);

export interface DerivedInsights {
	rateChange: number | null;
	rateDirection: "UP" | "DOWN" | "SAME" | null;
	bestCategory: { name: string; rate: number } | null;
	worstCategory: { name: string; rate: number } | null;
	bestDay: { day: string; rate: number } | null;
	worstDay: { day: string; rate: number } | null;
	avgDailyTodos: number;
	perfectDays: number;
	activeDays: number;
	weekdayRate: number;
	weekendRate: number;
	peakHour: { hour: number; count: number } | null;
	peakPeriod: string;
	topTimeSlots: { hour: number; count: number }[];
}

export function computeDerivedInsights(
	data: AggregatedReportData,
	locale: SupportedLocale = "ko",
): DerivedInsights {
	const dayNames = locale === "en" ? DAY_ENGLISH : DAY_KOREAN;
	// 달성률 변화
	let rateChange: number | null = null;
	let rateDirection: "UP" | "DOWN" | "SAME" | null = null;
	if (data.prevCompletionRate !== null) {
		rateChange = data.completionRate - data.prevCompletionRate;
		rateDirection = rateChange > 0 ? "UP" : rateChange < 0 ? "DOWN" : "SAME";
	}

	// 카테고리 분석
	const activeCats = data.categoryBreakdown.filter((c) => c.total > 0);
	const bestCategory =
		activeCats.length > 0
			? activeCats.reduce((a, b) => (b.rate > a.rate ? b : a))
			: null;
	const worstCategory =
		activeCats.length > 1
			? activeCats.reduce((a, b) => (b.rate < a.rate ? b : a))
			: null;

	// 요일 분석
	const activeDayPatterns = data.dayPatterns.filter((d) => d.total > 0);
	const bestDay =
		activeDayPatterns.length > 0
			? activeDayPatterns.reduce((a, b) => (b.rate > a.rate ? b : a))
			: null;
	const worstDay =
		activeDayPatterns.length > 1
			? activeDayPatterns.reduce((a, b) => (b.rate < a.rate ? b : a))
			: null;

	const activeDays = activeDayPatterns.length;
	const perfectDays = activeDayPatterns.filter((d) => d.rate === 100).length;
	const avgDailyTodos =
		activeDays > 0 ? Math.round(data.totalTodos / activeDays) : 0;

	// 주중 vs 주말
	const weekdayDays = activeDayPatterns.filter((d) => WEEKDAYS.has(d.day));
	const weekendDays = activeDayPatterns.filter((d) => !WEEKDAYS.has(d.day));

	const computeAvgRate = (
		days: { total: number; completed: number }[],
	): number => {
		const totalAll = days.reduce((s, d) => s + d.total, 0);
		const compAll = days.reduce((s, d) => s + d.completed, 0);
		return totalAll > 0 ? Math.round((compAll / totalAll) * 100) : 0;
	};

	const weekdayRate = computeAvgRate(weekdayDays);
	const weekendRate = computeAvgRate(weekendDays);

	// 시간대 분석
	const sortedTime = [...data.timePatterns].sort((a, b) => b.count - a.count);
	const peakHour = sortedTime[0] ?? null;
	const topTimeSlots = sortedTime.slice(0, 3);

	let peakPeriod = locale === "en" ? "none" : "없음";
	if (peakHour) {
		const h = peakHour.hour;
		if (h >= 6 && h < 12) {
			peakPeriod = locale === "en" ? "morning" : "오전";
		} else if (h >= 12 && h < 18) {
			peakPeriod = locale === "en" ? "afternoon" : "오후";
		} else if (h >= 18 && h < 23) {
			peakPeriod = locale === "en" ? "evening" : "저녁";
		} else {
			peakPeriod = locale === "en" ? "late night" : "새벽/밤";
		}
	}

	return {
		rateChange,
		rateDirection,
		bestCategory: bestCategory
			? { name: bestCategory.name, rate: bestCategory.rate }
			: null,
		worstCategory: worstCategory
			? { name: worstCategory.name, rate: worstCategory.rate }
			: null,
		bestDay: bestDay
			? { day: dayNames[bestDay.day] ?? bestDay.day, rate: bestDay.rate }
			: null,
		worstDay: worstDay
			? { day: dayNames[worstDay.day] ?? worstDay.day, rate: worstDay.rate }
			: null,
		avgDailyTodos,
		perfectDays,
		activeDays,
		weekdayRate,
		weekendRate,
		peakHour,
		peakPeriod,
		topTimeSlots,
	};
}
