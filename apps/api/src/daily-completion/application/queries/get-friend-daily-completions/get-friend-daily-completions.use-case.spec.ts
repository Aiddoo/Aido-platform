/**
 * GetFriendDailyCompletionsUseCase 단위 테스트
 *
 * Suites + 포트 mock + GWT 패턴 — 맞팔 검증, PUBLIC 집계, 소유자 기준 cache-aside 검증
 */

import { ErrorCode } from "@aido/errors";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { ApplicationException } from "@/shared/domain";
import type {
	DailyCompletionsRange,
	TodoAggregateByDate,
} from "../../../domain/daily-completion";
import {
	DAILY_COMPLETION_CACHE,
	type DailyCompletionCachePort,
} from "../../ports/daily-completion-cache.port";
import { FRIEND_PORT, type FriendPort } from "../../ports/friend.port";
import {
	TODO_COMPLETION_REPOSITORY,
	type TodoCompletionRepositoryPort,
} from "../../ports/todo-completion.repository.port";
import { GetFriendDailyCompletionsUseCase } from "./get-friend-daily-completions.use-case";

function buildAggregates(): TodoAggregateByDate[] {
	return [
		{
			date: new Date("2026-01-15T00:00:00.000Z"),
			total: 2,
			completed: 2,
			categoryColors: ["#FF6B43"],
		},
	];
}

describe("GetFriendDailyCompletionsUseCase — 친구 기간별 완료 현황 조회", () => {
	let useCase: GetFriendDailyCompletionsUseCase;
	let repository: Mocked<TodoCompletionRepositoryPort>;
	let cache: Mocked<DailyCompletionCachePort>;
	let friendPort: Mocked<FriendPort>;

	const input = {
		userId: "viewer-123",
		friendUserId: "friend-456",
		startDate: "2026-01-01",
		endDate: "2026-01-31",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			GetFriendDailyCompletionsUseCase,
		)
			.mock<TodoCompletionRepositoryPort>(TODO_COMPLETION_REPOSITORY)
			.impl(() => ({
				aggregatePublicByDateRange: jest.fn().mockResolvedValue([]),
			}))
			.mock<DailyCompletionCachePort>(DAILY_COMPLETION_CACHE)
			.impl(() => ({
				getPublicRange: jest.fn().mockResolvedValue(undefined),
				setPublicRange: jest.fn().mockResolvedValue(undefined),
			}))
			.mock<FriendPort>(FRIEND_PORT)
			.impl(() => ({ isMutualFriend: jest.fn().mockResolvedValue(true) }))
			.compile();

		useCase = unit;
		repository = unitRef.get<TodoCompletionRepositoryPort>(
			TODO_COMPLETION_REPOSITORY,
		);
		cache = unitRef.get<DailyCompletionCachePort>(DAILY_COMPLETION_CACHE);
		friendPort = unitRef.get<FriendPort>(FRIEND_PORT);
	});

	it("맞팔 관계가 아니면 FOLLOW_0906을 던진다", async () => {
		// Given
		friendPort.isMutualFriend.mockResolvedValue(false);

		// When / Then
		await expect(useCase.execute(input)).rejects.toMatchObject({
			errorCode: ErrorCode.FOLLOW_0906,
		});
		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			ApplicationException,
		);
		expect(repository.aggregatePublicByDateRange).not.toHaveBeenCalled();
	});

	it("친구의 PUBLIC 투두만 반열림 구간 [start, end+1일)로 집계한다", async () => {
		// When
		await useCase.execute(input);

		// Then - 소유자(친구) 기준, 종료일 포함 위해 end에 +1일
		expect(friendPort.isMutualFriend).toHaveBeenCalledWith(
			"viewer-123",
			"friend-456",
		);
		expect(repository.aggregatePublicByDateRange).toHaveBeenCalledWith({
			userId: "friend-456",
			startDate: new Date("2026-01-01T00:00:00.000Z"),
			endDate: new Date("2026-02-01T00:00:00.000Z"),
		});
	});

	it("집계를 일일 완료 요약으로 조립해 반환한다", async () => {
		// Given
		repository.aggregatePublicByDateRange.mockResolvedValue(buildAggregates());

		// When
		const result = await useCase.execute(input);

		// Then
		expect(result.completions).toHaveLength(1);
		expect(result.totalCompleteDays).toBe(1);
		expect(result.dateRange).toEqual({
			startDate: "2026-01-01",
			endDate: "2026-01-31",
		});
	});

	it("캐시 히트 시에도 맞팔 검증은 수행하고 저장소는 호출하지 않는다", async () => {
		// Given - 소유자 기준 공개 범위 캐시에 결과가 있음
		const cachedResult: DailyCompletionsRange = {
			completions: [
				{
					date: "2026-01-15",
					totalTodos: 2,
					completedTodos: 2,
					isComplete: true,
					completionRate: 100,
					categoryColors: ["#FF6B43"],
				},
			],
			totalCompleteDays: 1,
			dateRange: { startDate: "2026-01-01", endDate: "2026-01-31" },
		};
		cache.getPublicRange.mockResolvedValue(cachedResult);

		// When
		const result = await useCase.execute(input);

		// Then - 권한 확인은 캐시 히트와 무관하게 수행, 저장소 미호출
		expect(result).toBe(cachedResult);
		expect(friendPort.isMutualFriend).toHaveBeenCalled();
		expect(cache.getPublicRange).toHaveBeenCalledWith(
			"friend-456",
			"2026-01-01",
			"2026-01-31",
		);
		expect(repository.aggregatePublicByDateRange).not.toHaveBeenCalled();
		expect(cache.setPublicRange).not.toHaveBeenCalled();
	});

	it("캐시 미스 시 계산 결과를 소유자 기준 키로 캐싱한다", async () => {
		// Given - 캐시 미스 (기본 mock)
		repository.aggregatePublicByDateRange.mockResolvedValue(buildAggregates());

		// When
		const result = await useCase.execute(input);

		// Then - 뷰어가 아니라 소유자(친구) 키로 저장
		expect(cache.setPublicRange).toHaveBeenCalledWith(
			"friend-456",
			"2026-01-01",
			"2026-01-31",
			result,
		);
	});
});
