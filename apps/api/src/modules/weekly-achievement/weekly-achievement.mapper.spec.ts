import type { WeeklyAchievement } from "@/generated/prisma/client";
import type { WeeklyAchievementRecord } from "./types/weekly-achievement.types";
import { WeeklyAchievementMapper } from "./weekly-achievement.mapper";

describe("WeeklyAchievementMapper", () => {
	// ============================================
	// computeWeekLabel
	// ============================================

	describe("computeWeekLabel", () => {
		it("일반 주차의 라벨을 생성한다", () => {
			// Given - 2026년 10주차 (목요일: 3월 5일)
			// When
			const label = WeeklyAchievementMapper.computeWeekLabel(2026, 10);

			// Then
			expect(label).toMatch(/^\d+월 \d+주차$/);
			expect(label).toContain("3월");
		});

		it("연초 주차의 라벨을 생성한다", () => {
			// Given - 2026년 1주차
			// When
			const label = WeeklyAchievementMapper.computeWeekLabel(2026, 1);

			// Then
			expect(label).toMatch(/^\d+월 \d+주차$/);
		});

		it("연말 주차의 라벨을 생성한다", () => {
			// Given - 2026년 53주차 또는 마지막 주차
			// When
			const label = WeeklyAchievementMapper.computeWeekLabel(2025, 52);

			// Then
			expect(label).toMatch(/^\d+월 \d+주차$/);
		});
	});

	// ============================================
	// computeDateRange
	// ============================================

	describe("computeDateRange", () => {
		it("월요일~일요일 범위를 반환한다", () => {
			// Given - 2026년 10주차
			// When
			const range = WeeklyAchievementMapper.computeDateRange(2026, 10);

			// Then
			expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

			// 시작일은 월요일, 종료일은 일요일 (6일 차이)
			const start = new Date(range.startDate);
			const end = new Date(range.endDate);
			const diffDays =
				(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
			expect(diffDays).toBe(6);
		});

		it("2026년 10주차의 정확한 날짜를 반환한다", () => {
			// Given/When
			const range = WeeklyAchievementMapper.computeDateRange(2026, 10);

			// Then - 2026년 10주차는 3/2(월) ~ 3/8(일)
			expect(range.startDate).toBe("2026-03-02");
			expect(range.endDate).toBe("2026-03-08");
		});
	});

	// ============================================
	// computeStreak
	// ============================================

	describe("computeStreak", () => {
		it("빈 배열이면 0을 반환한다", () => {
			// When
			const result = WeeklyAchievementMapper.computeStreak([]);

			// Then
			expect(result).toEqual({ currentStreak: 0, bestStreak: 0 });
		});

		it("단일 레코드면 streak은 1이다", () => {
			// When
			const result = WeeklyAchievementMapper.computeStreak([
				{ year: 2026, week: 5 },
			]);

			// Then
			expect(result).toEqual({ currentStreak: 1, bestStreak: 1 });
		});

		it("연속 주차의 streak을 계산한다", () => {
			// Given
			const records: WeeklyAchievementRecord[] = [
				{ year: 2026, week: 5 },
				{ year: 2026, week: 6 },
				{ year: 2026, week: 7 },
			];

			// When
			const result = WeeklyAchievementMapper.computeStreak(records);

			// Then
			expect(result).toEqual({ currentStreak: 3, bestStreak: 3 });
		});

		it("중간에 빈 주가 있으면 streak이 끊긴다", () => {
			// Given
			const records: WeeklyAchievementRecord[] = [
				{ year: 2026, week: 5 },
				{ year: 2026, week: 6 },
				// week 7 missing
				{ year: 2026, week: 8 },
				{ year: 2026, week: 9 },
				{ year: 2026, week: 10 },
			];

			// When
			const result = WeeklyAchievementMapper.computeStreak(records);

			// Then
			expect(result.currentStreak).toBe(3); // 8, 9, 10
			expect(result.bestStreak).toBe(3); // 8, 9, 10
		});

		it("연말→연초 경계를 처리한다", () => {
			// Given - 2025년 마지막 주 → 2026년 1주차
			const records: WeeklyAchievementRecord[] = [
				{ year: 2025, week: 51 },
				{ year: 2025, week: 52 },
				{ year: 2026, week: 1 },
				{ year: 2026, week: 2 },
			];

			// When
			const result = WeeklyAchievementMapper.computeStreak(records);

			// Then
			expect(result.currentStreak).toBe(4);
			expect(result.bestStreak).toBe(4);
		});

		it("bestStreak과 currentStreak이 다를 수 있다", () => {
			// Given
			const records: WeeklyAchievementRecord[] = [
				{ year: 2026, week: 1 },
				{ year: 2026, week: 2 },
				{ year: 2026, week: 3 },
				{ year: 2026, week: 4 }, // bestStreak = 4
				// gap
				{ year: 2026, week: 8 },
				{ year: 2026, week: 9 }, // currentStreak = 2
			];

			// When
			const result = WeeklyAchievementMapper.computeStreak(records);

			// Then
			expect(result.currentStreak).toBe(2);
			expect(result.bestStreak).toBe(4);
		});

		it("53주차 연도의 연말→연초 경계를 처리한다", () => {
			// Given - 2020년은 53 ISO weeks
			const records: WeeklyAchievementRecord[] = [
				{ year: 2020, week: 52 },
				{ year: 2020, week: 53 },
				{ year: 2021, week: 1 },
			];

			// When
			const result = WeeklyAchievementMapper.computeStreak(records);

			// Then
			expect(result.currentStreak).toBe(3);
			expect(result.bestStreak).toBe(3);
		});
	});

	// ============================================
	// computeSummary
	// ============================================

	describe("computeSummary", () => {
		it("빈 배열이면 모든 값이 0이다", () => {
			// When
			const summary = WeeklyAchievementMapper.computeSummary([]);

			// Then
			expect(summary).toEqual({
				totalWeeks: 0,
				perfectWeeks: 0,
				currentStreak: 0,
				bestStreak: 0,
				averageRate: 0,
			});
		});

		it("통계를 정확하게 계산한다", () => {
			// Given
			const entities = [
				mockEntity({ year: 2026, week: 1, totalTodos: 10, completedTodos: 10 }), // 100%
				mockEntity({ year: 2026, week: 2, totalTodos: 10, completedTodos: 8 }), // 80%
				mockEntity({ year: 2026, week: 3, totalTodos: 10, completedTodos: 10 }), // 100%
			];

			// When
			const summary = WeeklyAchievementMapper.computeSummary(entities);

			// Then
			expect(summary.totalWeeks).toBe(3);
			expect(summary.perfectWeeks).toBe(2);
			expect(summary.averageRate).toBe(93); // (100+80+100)/3 = 93.33 → 93
			expect(summary.currentStreak).toBe(3);
			expect(summary.bestStreak).toBe(3);
		});
	});

	// ============================================
	// toResponse
	// ============================================

	describe("toResponse", () => {
		it("엔티티를 DTO로 변환한다", () => {
			// Given
			const entity = mockEntity({
				id: 42,
				year: 2026,
				week: 10,
				totalTodos: 15,
				completedTodos: 14,
				achievedAt: new Date("2026-03-08T11:00:00.000Z"),
			});

			// When
			const dto = WeeklyAchievementMapper.toResponse(entity);

			// Then
			expect(dto.id).toBe(42);
			expect(dto.year).toBe(2026);
			expect(dto.week).toBe(10);
			expect(dto.weekLabel).toMatch(/\d+월 \d+주차/);
			expect(dto.dateRange.startDate).toBe("2026-03-02");
			expect(dto.dateRange.endDate).toBe("2026-03-08");
			expect(dto.totalTodos).toBe(15);
			expect(dto.completedTodos).toBe(14);
			expect(dto.completionRate).toBe(93);
			expect(dto.achievedAt).toBe("2026-03-08T11:00:00.000Z");
		});

		it("totalTodos가 0이면 completionRate는 0이다", () => {
			// Given
			const entity = mockEntity({ totalTodos: 0, completedTodos: 0 });

			// When
			const dto = WeeklyAchievementMapper.toResponse(entity);

			// Then
			expect(dto.completionRate).toBe(0);
		});
	});
});

// ============================================
// 헬퍼
// ============================================

function mockEntity(overrides?: Partial<WeeklyAchievement>): WeeklyAchievement {
	return {
		id: 1,
		userId: "user-123",
		year: 2026,
		week: 1,
		totalTodos: 10,
		completedTodos: 8,
		achievedAt: new Date("2026-01-05T11:00:00.000Z"),
		createdAt: new Date("2026-01-05T11:00:00.000Z"),
		...overrides,
	};
}
