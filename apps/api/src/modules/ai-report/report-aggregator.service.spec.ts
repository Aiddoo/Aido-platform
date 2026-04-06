/**
 * ReportAggregatorService 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Promise.all 병렬 쿼리 검증
 * - 집계 계산 정확성 검증
 * - 빈 데이터 처리 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { DatabaseService } from "@/database/database.service";

import { ReportAggregatorService } from "./report-aggregator.service";
import type { AggregateParams } from "./types";

describe("ReportAggregatorService — 리포트 집계 서비스", () => {
	let service: ReportAggregatorService;
	let db: Mocked<DatabaseService>;

	const baseParams: AggregateParams = {
		userId: "user-123",
		startDate: new Date("2026-02-23T15:00:00.000Z"), // KST 2/24 00:00
		endDate: new Date("2026-03-02T15:00:00.000Z"), // KST 3/3 00:00
		prevStartDate: new Date("2026-02-16T15:00:00.000Z"),
		prevEndDate: new Date("2026-02-23T15:00:00.000Z"),
		timezone: "Asia/Seoul",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			ReportAggregatorService,
		).compile();

		service = unit;
		db = unitRef.get(DatabaseService);
	});

	/**
	 * 모든 DB 쿼리를 빈 결과로 설정하는 헬퍼
	 */
	function setupEmptyQueries(): void {
		(db.todo.groupBy as jest.Mock).mockResolvedValue([]);
		(db.todo.count as jest.Mock).mockResolvedValue(0);
		(db.todoCategory.findMany as jest.Mock).mockResolvedValue([]);
		(db.todo.findMany as jest.Mock).mockResolvedValue([]);
	}

	/**
	 * 정상 데이터로 DB 쿼리를 설정하는 헬퍼
	 */
	function setupNormalQueries(): void {
		// groupBy for daily totals
		const dailyTotalGroups = [
			{ startDate: new Date("2026-02-24T00:00:00.000Z"), _count: { id: 3 } },
			{ startDate: new Date("2026-02-25T00:00:00.000Z"), _count: { id: 2 } },
			{ startDate: new Date("2026-02-26T00:00:00.000Z"), _count: { id: 4 } },
		];
		// groupBy for daily completed
		const dailyCompletedGroups = [
			{ startDate: new Date("2026-02-24T00:00:00.000Z"), _count: { id: 3 } },
			{ startDate: new Date("2026-02-25T00:00:00.000Z"), _count: { id: 1 } },
			{ startDate: new Date("2026-02-26T00:00:00.000Z"), _count: { id: 4 } },
		];
		// groupBy for category totals
		const catTotalGroups = [
			{ categoryId: 1, _count: { id: 5 } },
			{ categoryId: 2, _count: { id: 4 } },
		];
		// groupBy for category completed
		const catCompletedGroups = [
			{ categoryId: 1, _count: { id: 4 } },
			{ categoryId: 2, _count: { id: 4 } },
		];

		const categories = [
			{ id: 1, name: "업무", color: "#FF0000" },
			{ id: 2, name: "개인", color: "#00FF00" },
		];

		const completedTodos = [
			{
				startDate: new Date("2026-02-24T00:00:00.000Z"),
				completedAt: new Date("2026-02-24T01:00:00.000Z"),
			},
			{
				startDate: new Date("2026-02-24T00:00:00.000Z"),
				completedAt: new Date("2026-02-24T05:00:00.000Z"),
			},
			{
				startDate: new Date("2026-02-26T00:00:00.000Z"),
				completedAt: new Date("2026-02-26T05:00:00.000Z"),
			},
		];

		// Promise.all 순서: dailyTotal, dailyCompleted, prevTotal, prevCompleted,
		//                   catTotal, catCompleted, categories, completedTodos
		(db.todo.groupBy as jest.Mock)
			.mockResolvedValueOnce(dailyTotalGroups)
			.mockResolvedValueOnce(dailyCompletedGroups)
			.mockResolvedValueOnce(catTotalGroups)
			.mockResolvedValueOnce(catCompletedGroups);

		(db.todo.count as jest.Mock)
			.mockResolvedValueOnce(7) // prevTotal
			.mockResolvedValueOnce(5); // prevCompleted

		(db.todoCategory.findMany as jest.Mock).mockResolvedValue(categories);
		(db.todo.findMany as jest.Mock).mockResolvedValue(completedTodos);
	}

	describe("병렬 쿼리", () => {
		it("8개의 쿼리가 병렬로 실행되어야 한다 (N+1 방지)", async () => {
			// Given - 빈 데이터로 쿼리 설정
			setupEmptyQueries();

			// When - aggregate를 호출하면
			await service.aggregate(baseParams);

			// Then - groupBy 4회, count 2회, findMany 2회가 호출되어야 한다
			expect(db.todo.groupBy).toHaveBeenCalledTimes(4);
			expect(db.todo.count).toHaveBeenCalledTimes(2);
			expect(db.todoCategory.findMany).toHaveBeenCalledTimes(1);
			expect(db.todo.findMany).toHaveBeenCalledTimes(1);
		});
	});

	describe("빈 데이터 처리", () => {
		it("활동이 없으면 hasActivity: false, 모든 통계 0이어야 한다", async () => {
			// Given - 모든 쿼리가 빈 결과를 반환
			setupEmptyQueries();

			// When - aggregate를 호출하면
			const result = await service.aggregate(baseParams);

			// Then - 모든 통계가 0이고 hasActivity가 false여야 한다
			expect(result.hasActivity).toBe(false);
			expect(result.totalTodos).toBe(0);
			expect(result.completedTodos).toBe(0);
			expect(result.completionRate).toBe(0);
			expect(result.prevCompletionRate).toBeNull();
			expect(result.streakDays).toBe(0);
			expect(result.categoryBreakdown).toEqual([]);
			expect(result.dayPatterns).toHaveLength(7); // 항상 7요일
			expect(result.timePatterns).toEqual([]);
		});

		it("빈 데이터에서도 dayPatterns은 7개 요일을 모두 포함해야 한다", async () => {
			// Given - 빈 데이터
			setupEmptyQueries();

			// When - aggregate를 호출하면
			const result = await service.aggregate(baseParams);

			// Then - MON~SUN까지 7개 요일이 모두 포함되어야 한다
			const dayOrder = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
			expect(result.dayPatterns.map((d) => d.day)).toEqual(dayOrder);
			for (const day of result.dayPatterns) {
				expect(day.total).toBe(0);
				expect(day.completed).toBe(0);
				expect(day.rate).toBe(0);
			}
		});
	});

	describe("정상 데이터 집계", () => {
		it("전체/완료 할 일 수와 달성률을 정확하게 계산해야 한다", async () => {
			// Given - 정상 데이터
			setupNormalQueries();

			// When - aggregate를 호출하면
			const result = await service.aggregate(baseParams);

			// Then - 총 9개 할 일 중 8개 완료, 달성률 89%
			expect(result.totalTodos).toBe(9); // 3 + 2 + 4
			expect(result.completedTodos).toBe(8); // 3 + 1 + 4
			expect(result.completionRate).toBe(89); // Math.round(8/9*100)
			expect(result.hasActivity).toBe(true);
		});

		it("이전 기간 달성률을 정확하게 계산해야 한다", async () => {
			// Given - 이전 기간 7개 중 5개 완료
			setupNormalQueries();

			// When - aggregate를 호출하면
			const result = await service.aggregate(baseParams);

			// Then - 이전 기간 달성률 71%
			expect(result.prevCompletionRate).toBe(71); // Math.round(5/7*100)
		});

		it("카테고리별 집계를 정확하게 계산해야 한다", async () => {
			// Given - 정상 데이터
			setupNormalQueries();

			// When - aggregate를 호출하면
			const result = await service.aggregate(baseParams);

			// Then - 카테고리별 집계가 total 기준 내림차순이어야 한다
			expect(result.categoryBreakdown).toHaveLength(2);
			// total 기준 내림차순 정렬: 업무(5) > 개인(4)
			expect(result.categoryBreakdown[0]?.name).toBe("업무");
			expect(result.categoryBreakdown[0]?.total).toBe(5);
			expect(result.categoryBreakdown[0]?.completed).toBe(4);
			expect(result.categoryBreakdown[0]?.rate).toBe(80);
			expect(result.categoryBreakdown[1]?.name).toBe("개인");
			expect(result.categoryBreakdown[1]?.total).toBe(4);
			expect(result.categoryBreakdown[1]?.completed).toBe(4);
			expect(result.categoryBreakdown[1]?.rate).toBe(100);
		});

		it("시간대별 패턴을 정확하게 계산해야 한다", async () => {
			// Given - 정상 데이터 (completedAt 기반)
			setupNormalQueries();

			// When - aggregate를 호출하면
			const result = await service.aggregate(baseParams);

			// Then - 완료 시간 기반 시간대 패턴이 있어야 한다
			expect(result.timePatterns.length).toBeGreaterThan(0);
			// count 기준 내림차순 정렬
			for (let i = 1; i < result.timePatterns.length; i++) {
				const prev = result.timePatterns[i - 1]?.count ?? 0;
				const curr = result.timePatterns[i]?.count ?? 0;
				expect(prev).toBeGreaterThanOrEqual(curr);
			}
		});
	});
});
