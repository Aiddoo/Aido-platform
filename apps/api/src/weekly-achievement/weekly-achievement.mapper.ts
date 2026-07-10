import dayjs from "dayjs";
import isLeapYear from "dayjs/plugin/isLeapYear";
import isoWeek from "dayjs/plugin/isoWeek";
import isoWeeksInYear from "dayjs/plugin/isoWeeksInYear";
import type { WeeklyAchievement } from "@/generated/prisma/client";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import type {
	StreakResult,
	WeeklyAchievementRecord,
} from "./types/weekly-achievement.types";

dayjs.extend(isoWeek);
dayjs.extend(isoWeeksInYear);
dayjs.extend(isLeapYear);

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
 * WeeklyAchievement 도메인의 Mapper 클래스
 *
 * DB 엔티티를 API 응답 DTO로 변환하고, 통계를 계산합니다.
 */
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

export abstract class WeeklyAchievementMapper {
	/**
	 * ISO 주차의 목요일 기준으로 월을 판별하여 주차 라벨을 생성합니다.
	 *
	 * @example computeWeekLabel(2026, 10)        // "3월 2주차"
	 * @example computeWeekLabel(2026, 10, "en")  // "Week 2 of Mar"
	 */
	static computeWeekLabel(
		year: number,
		week: number,
		locale: SupportedLocale = "ko",
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

		const weekInMonth = Math.max(
			1,
			Math.floor(thursday.diff(adjustedFirst, "day") / 7) + 1,
		);

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
	static computeDateRange(
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
	 * 연속 달성 주차(streak)를 계산합니다.
	 * 연말→연초 경계(예: 53주→1주)도 처리합니다.
	 *
	 * @param records - year/week 오름차순 정렬된 기록 배열
	 * @returns currentStreak (최신 주차부터 거슬러 올라간 연속 수), bestStreak (최고 연속)
	 */
	static computeStreak(records: WeeklyAchievementRecord[]): StreakResult {
		if (records.length === 0) {
			return { currentStreak: 0, bestStreak: 0 };
		}

		let bestStreak = 1;
		let streak = 1;

		for (let i = 1; i < records.length; i++) {
			const prev = records[i - 1];
			const curr = records[i];
			if (prev && curr && this.#isConsecutiveWeek(prev, curr)) {
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
	static computeSummary(entities: WeeklyAchievement[]): {
		totalWeeks: number;
		perfectWeeks: number;
		currentStreak: number;
		bestStreak: number;
		averageRate: number;
	} {
		const totalWeeks = entities.length;

		if (totalWeeks === 0) {
			return {
				totalWeeks: 0,
				perfectWeeks: 0,
				currentStreak: 0,
				bestStreak: 0,
				averageRate: 0,
			};
		}

		const perfectWeeks = entities.filter(
			(e) => e.totalTodos > 0 && e.completedTodos === e.totalTodos,
		).length;

		const rates = entities.map((e) =>
			e.totalTodos > 0
				? Math.round((e.completedTodos / e.totalTodos) * 100)
				: 0,
		);
		const averageRate = Math.round(
			rates.reduce((sum, r) => sum + r, 0) / totalWeeks,
		);

		const records: WeeklyAchievementRecord[] = entities
			.map((e) => ({ year: e.year, week: e.week }))
			.sort((a, b) => a.year - b.year || a.week - b.week);

		const { currentStreak, bestStreak } = this.computeStreak(records);

		return { totalWeeks, perfectWeeks, currentStreak, bestStreak, averageRate };
	}

	/**
	 * DB 엔티티를 응답 DTO로 변환합니다.
	 */
	static toResponse(entity: WeeklyAchievement, locale: SupportedLocale = "ko") {
		const completionRate =
			entity.totalTodos > 0
				? Math.round((entity.completedTodos / entity.totalTodos) * 100)
				: 0;

		return {
			id: entity.id,
			year: entity.year,
			week: entity.week,
			weekLabel: this.computeWeekLabel(entity.year, entity.week, locale),
			dateRange: this.computeDateRange(entity.year, entity.week),
			totalTodos: entity.totalTodos,
			completedTodos: entity.completedTodos,
			completionRate,
			achievedAt: entity.achievedAt.toISOString(),
		};
	}

	/**
	 * 두 주차가 연속인지 판별합니다 (연말→연초 경계 포함).
	 */
	static #isConsecutiveWeek(
		prev: WeeklyAchievementRecord,
		curr: WeeklyAchievementRecord,
	): boolean {
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
}
