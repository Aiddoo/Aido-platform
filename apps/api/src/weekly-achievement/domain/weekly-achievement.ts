import { ErrorCode } from "@aido/errors";
import dayjs from "dayjs";
import isLeapYear from "dayjs/plugin/isLeapYear";
import isoWeek from "dayjs/plugin/isoWeek";
import isoWeeksInYear from "dayjs/plugin/isoWeeksInYear";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

dayjs.extend(isoWeek);
dayjs.extend(isoWeeksInYear);
dayjs.extend(isLeapYear);

/** 주차 라벨 로케일 (프레젠테이션 SupportedLocale과 동일 집합, 도메인 소유) */
export type WeekLabelLocale = "ko" | "en";

/** 영속성 중립 주간 달성 레코드 (포트가 반환) */
export interface WeeklyAchievementRow {
	id: number;
	year: number;
	week: number;
	totalTodos: number;
	completedTodos: number;
	achievedAt: Date;
}

/** 주간 달성 upsert 입력 (스케줄러 집계 결과) */
export interface WeeklyAchievementUpsert {
	userId: string;
	year: number;
	week: number;
	totalTodos: number;
	completedTodos: number;
	achievedAt: Date;
}

/** 응답 뷰 (컨트롤러 계약과 동일 shape) */
export interface WeeklyAchievementView {
	id: number;
	year: number;
	week: number;
	weekLabel: string;
	dateRange: { startDate: string; endDate: string };
	totalTodos: number;
	completedTodos: number;
	completionRate: number;
	achievedAt: string;
}

/** 연도 요약 통계 */
export interface WeeklyAchievementSummary {
	totalWeeks: number;
	perfectWeeks: number;
	currentStreak: number;
	bestStreak: number;
	averageRate: number;
}

/** streak 계산용 최소 레코드 (year/week만) */
export interface WeeklyAchievementRecord {
	year: number;
	week: number;
}

export interface StreakResult {
	currentStreak: number;
	bestStreak: number;
}

const MONTH_SHORT_EN = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

/**
 * ISO year + week → 해당 주의 기준일(dayjs 인스턴스)을 반환합니다.
 *
 * `isoWeekYear()` 는 getter 전용이므로, Jan 4(항상 ISO week 1에 포함)를
 * 기준점으로 삼아 `.isoWeek(week)` setter 로 목표 주차를 설정합니다.
 */
function dayjsFromIsoWeek(year: number, week: number): dayjs.Dayjs {
	return dayjs(`${year}-01-04`).isoWeek(week);
}

/**
 * 완료율(0-100)을 계산합니다. 할 일이 0개면 0.
 */
function completionRateOf(totalTodos: number, completedTodos: number): number {
	return totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
}

/**
 * ISO 주차의 목요일 기준으로 월을 판별하여 주차 라벨을 생성합니다.
 *
 * @example computeWeekLabel(2026, 10)        // "3월 2주차"
 * @example computeWeekLabel(2026, 10, "en")  // "Week 2 of Mar"
 */
export function computeWeekLabel(
	year: number,
	week: number,
	locale: WeekLabelLocale = "ko",
): string {
	// ISO 주차의 목요일을 기준으로 해당 주의 월을 결정
	const thursday = dayjsFromIsoWeek(year, week).isoWeekday(4);
	const month = thursday.month() + 1; // 0-indexed → 1-indexed

	// 해당 월의 몇 번째 주인지 계산 (목요일 기준)
	const firstThursdayOfMonth = thursday.startOf("month").isoWeekday(4);

	// 첫째 주의 목요일이 다음 달이면 조정
	let adjustedFirst = firstThursdayOfMonth;
	if (adjustedFirst.month() + 1 !== month) {
		adjustedFirst = adjustedFirst.add(7, "day");
	}

	const weekInMonth = Math.max(1, Math.floor(thursday.diff(adjustedFirst, "day") / 7) + 1);

	if (locale === "en") {
		return `Week ${weekInMonth} of ${MONTH_SHORT_EN[month - 1]}`;
	}

	return `${month}월 ${weekInMonth}주차`;
}

/**
 * ISO 주차의 시작일(월요일)과 종료일(일요일)을 계산합니다.
 *
 * @example computeDateRange(2026, 10) // { startDate: "2026-03-02", endDate: "2026-03-08" }
 */
export function computeDateRange(
	year: number,
	week: number,
): { startDate: string; endDate: string } {
	const monday = dayjsFromIsoWeek(year, week).isoWeekday(1).startOf("day");
	const sunday = monday.add(6, "day");

	return {
		startDate: monday.format("YYYY-MM-DD"),
		endDate: sunday.format("YYYY-MM-DD"),
	};
}

/**
 * 두 주차가 연속인지 판별합니다 (연말→연초 경계 포함).
 */
function isConsecutiveWeek(prev: WeeklyAchievementRecord, curr: WeeklyAchievementRecord): boolean {
	// 같은 해, 연속 주차
	if (prev.year === curr.year && curr.week === prev.week + 1) {
		return true;
	}

	// 연말 → 연초 경계: prev가 해당 연도의 마지막 주이고, curr이 다음 연도 1주차
	if (curr.year === prev.year + 1 && curr.week === 1) {
		const maxWeeks = dayjsFromIsoWeek(prev.year, 1).isoWeeksInYear();
		return prev.week === maxWeeks;
	}

	return false;
}

/**
 * 연속 달성 주차(streak)를 계산합니다.
 * 연말→연초 경계(예: 53주→1주)도 처리합니다.
 *
 * @param records - year/week 오름차순 정렬된 기록 배열
 * @returns currentStreak (최신 주차부터 거슬러 올라간 연속 수), bestStreak (최고 연속)
 */
export function computeStreak(records: WeeklyAchievementRecord[]): StreakResult {
	if (records.length === 0) {
		return { currentStreak: 0, bestStreak: 0 };
	}

	let bestStreak = 1;
	let streak = 1;

	for (let i = 1; i < records.length; i++) {
		const prev = records[i - 1];
		const curr = records[i];
		if (prev && curr && isConsecutiveWeek(prev, curr)) {
			streak++;
		} else {
			streak = 1;
		}

		if (streak > bestStreak) {
			bestStreak = streak;
		}
	}

	return { currentStreak: streak, bestStreak };
}

/**
 * 전체 기록에서 통계 요약을 계산합니다.
 */
export function computeSummary(rows: WeeklyAchievementRow[]): WeeklyAchievementSummary {
	const totalWeeks = rows.length;

	if (totalWeeks === 0) {
		return {
			totalWeeks: 0,
			perfectWeeks: 0,
			currentStreak: 0,
			bestStreak: 0,
			averageRate: 0,
		};
	}

	const perfectWeeks = rows.filter(
		(r) => r.totalTodos > 0 && r.completedTodos === r.totalTodos,
	).length;

	const rates = rows.map((r) => completionRateOf(r.totalTodos, r.completedTodos));
	const averageRate = Math.round(rates.reduce((sum, r) => sum + r, 0) / totalWeeks);

	const records: WeeklyAchievementRecord[] = rows
		.map((r) => ({ year: r.year, week: r.week }))
		.sort((a, b) => a.year - b.year || a.week - b.week);

	const { currentStreak, bestStreak } = computeStreak(records);

	return { totalWeeks, perfectWeeks, currentStreak, bestStreak, averageRate };
}

/**
 * DB 레코드를 응답 뷰로 변환합니다.
 */
export function toWeeklyAchievementView(
	row: WeeklyAchievementRow,
	locale: WeekLabelLocale = "ko",
): WeeklyAchievementView {
	return {
		id: row.id,
		year: row.year,
		week: row.week,
		weekLabel: computeWeekLabel(row.year, row.week, locale),
		dateRange: computeDateRange(row.year, row.week),
		totalTodos: row.totalTodos,
		completedTodos: row.completedTodos,
		completionRate: completionRateOf(row.totalTodos, row.completedTodos),
		achievedAt: row.achievedAt.toISOString(),
	};
}

/**
 * upsert 입력의 도메인 불변식을 검증한 스냅샷을 반환합니다.
 *
 * 불변식: 완료 수는 0 이상이며 전체 수를 초과할 수 없고, 주차는 ISO 범위(1-53)여야 합니다.
 * 위반 시 DomainException(SYS_0002).
 */
export function buildWeeklyAchievementSnapshot(
	input: WeeklyAchievementUpsert,
): WeeklyAchievementUpsert {
	if (input.totalTodos < 0) {
		throw new DomainException(ErrorCode.SYS_0002, {
			field: "totalTodos",
			value: input.totalTodos,
		});
	}
	if (input.completedTodos < 0 || input.completedTodos > input.totalTodos) {
		throw new DomainException(ErrorCode.SYS_0002, {
			field: "completedTodos",
			completedTodos: input.completedTodos,
			totalTodos: input.totalTodos,
		});
	}
	if (input.week < 1 || input.week > 53) {
		throw new DomainException(ErrorCode.SYS_0002, {
			field: "week",
			value: input.week,
		});
	}

	return input;
}
