/**
 * GetDailyCompletionsUseCase 단위 테스트
 *
 * Suites + 포트 mock + GWT 패턴 — 집계→도메인 조립과 cache-aside(히트/미스) 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { DailyCompletionsRange, TodoAggregateByDate } from "../../../domain/daily-completion";
import {
	DAILY_COMPLETION_CACHE,
	type DailyCompletionCachePort,
} from "../../ports/daily-completion-cache.port";
import {
	TODO_COMPLETION_REPOSITORY,
	type TodoCompletionRepositoryPort,
} from "../../ports/todo-completion.repository.port";
import { GetDailyCompletionsUseCase } from "./get-daily-completions.use-case";

function buildAggregates(): TodoAggregateByDate[] {
	return [
		{
			date: new Date("2026-01-15T00:00:00.000Z"),
			total: 3,
			completed: 3,
			categoryColors: ["#FF6B43"],
		},
		{
			date: new Date("2026-01-16T00:00:00.000Z"),
			total: 4,
			completed: 2,
			categoryColors: ["#FF6B43", "#4A90D9"],
		},
	];
}

describe("GetDailyCompletionsUseCase — 기간별 완료 현황 조회", () => {
	let useCase: GetDailyCompletionsUseCase;
	let repository: Mocked<TodoCompletionRepositoryPort>;
	let cache: Mocked<DailyCompletionCachePort>;

	const input = {
		userId: "user-123",
		startDate: "2026-01-01",
		endDate: "2026-01-31",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetDailyCompletionsUseCase)
			.mock<TodoCompletionRepositoryPort>(TODO_COMPLETION_REPOSITORY)
			.impl(() => ({ aggregateByDateRange: jest.fn().mockResolvedValue([]) }))
			.mock<DailyCompletionCachePort>(DAILY_COMPLETION_CACHE)
			.impl(() => ({
				getRange: jest.fn().mockResolvedValue(undefined),
				setRange: jest.fn().mockResolvedValue(undefined),
				invalidate: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		useCase = unit;
		repository = unitRef.get<TodoCompletionRepositoryPort>(TODO_COMPLETION_REPOSITORY);
		cache = unitRef.get<DailyCompletionCachePort>(DAILY_COMPLETION_CACHE);
	});

	it("반열림 구간 [start, end+1일)로 집계를 조회한다", async () => {
		// Given - 캐시 미스 (기본 mock)

		// When
		await useCase.execute(input);

		// Then - 종료일 포함을 위해 end에 +1일
		expect(repository.aggregateByDateRange).toHaveBeenCalledWith({
			userId: "user-123",
			startDate: new Date("2026-01-01T00:00:00.000Z"),
			endDate: new Date("2026-02-01T00:00:00.000Z"),
		});
	});

	it("집계를 일일 완료 요약으로 조립해 반환한다", async () => {
		// Given
		repository.aggregateByDateRange.mockResolvedValue(buildAggregates());

		// When
		const result = await useCase.execute(input);

		// Then
		expect(result.completions).toHaveLength(2);
		expect(result.totalCompleteDays).toBe(1);
		expect(result.dateRange).toEqual({
			startDate: "2026-01-01",
			endDate: "2026-01-31",
		});
	});

	it("캐시 히트 시 저장소를 호출하지 않고 캐시 값을 반환한다", async () => {
		// Given - 캐시에 결과가 있음
		const cachedResult: DailyCompletionsRange = {
			completions: [
				{
					date: "2026-01-15",
					totalTodos: 3,
					completedTodos: 3,
					isComplete: true,
					completionRate: 100,
					categoryColors: ["#FF6B43"],
				},
			],
			totalCompleteDays: 1,
			dateRange: { startDate: "2026-01-01", endDate: "2026-01-31" },
		};
		cache.getRange.mockResolvedValue(cachedResult);

		// When
		const result = await useCase.execute(input);

		// Then - 저장소 미호출, 재캐싱도 없음
		expect(result).toBe(cachedResult);
		expect(cache.getRange).toHaveBeenCalledWith("user-123", "2026-01-01", "2026-01-31");
		expect(repository.aggregateByDateRange).not.toHaveBeenCalled();
		expect(cache.setRange).not.toHaveBeenCalled();
	});

	it("캐시 미스 시 계산 결과를 정규화된 키로 캐싱한다", async () => {
		// Given - 캐시 미스 (기본 mock)
		repository.aggregateByDateRange.mockResolvedValue(buildAggregates());

		// When
		const result = await useCase.execute(input);

		// Then - YYYY-MM-DD 키 세그먼트로 결과 저장
		expect(cache.setRange).toHaveBeenCalledWith("user-123", "2026-01-01", "2026-01-31", result);
	});

	it("집계가 없으면 빈 결과를 반환한다", async () => {
		// Given - 집계 없음 (기본 mock)

		// When
		const result = await useCase.execute(input);

		// Then
		expect(result.completions).toEqual([]);
		expect(result.totalCompleteDays).toBe(0);
	});
});
