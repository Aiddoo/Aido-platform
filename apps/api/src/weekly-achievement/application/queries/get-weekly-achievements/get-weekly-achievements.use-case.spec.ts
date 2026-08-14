/**
 * GetWeeklyAchievementsUseCase 단위 테스트
 *
 * - 커서 정규화 → 목록(페이지) + 연도 전체 기록을 병렬 조회 → 뷰 매핑 + 요약 합성
 * - hasNext/nextCursor는 use-case가 소유(take=size+1 초과분으로 판정, nextCursor=마지막 노출 주차)
 * - summary는 연도 전체 기록으로 computeSummary가 계산(연속 주차·완벽 주차·평균 완료율)
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createWeeklyAchievementRepositoryMock } from "@test/mocks/ports/weekly-achievement.mock";

import { PaginationService } from "@/shared/application/pagination";

import type { WeeklyAchievementRow } from "../../../domain/weekly-achievement";
import {
	WEEKLY_ACHIEVEMENT_REPOSITORY,
	type WeeklyAchievementRepositoryPort,
} from "../../ports/weekly-achievement.repository.port";
import { GetWeeklyAchievementsUseCase } from "./get-weekly-achievements.use-case";

function buildRow(week: number, total = 5, completed = 5): WeeklyAchievementRow {
	return {
		id: week,
		year: 2026,
		week,
		totalTodos: total,
		completedTodos: completed,
		achievedAt: new Date("2026-01-01T00:00:00.000Z"),
	};
}

describe("GetWeeklyAchievementsUseCase — 연도별 주간 달성 목록 조회 (커서 + 요약)", () => {
	let useCase: GetWeeklyAchievementsUseCase;
	let repository: Mocked<WeeklyAchievementRepositoryPort>;
	let paginationService: Mocked<PaginationService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetWeeklyAchievementsUseCase)
			.mock<WeeklyAchievementRepositoryPort>(WEEKLY_ACHIEVEMENT_REPOSITORY)
			.impl(() => createWeeklyAchievementRepositoryMock())
			.compile();

		useCase = unit;
		repository = unitRef.get<WeeklyAchievementRepositoryPort>(WEEKLY_ACHIEVEMENT_REPOSITORY);
		paginationService = unitRef.get(PaginationService);

		paginationService.normalizeCursorPagination.mockImplementation((params) => {
			const size = params.size ?? 20;
			return { cursor: params.cursor, size, take: size + 1 };
		});
	});

	it("목록과 연도 전체 기록을 병렬 조회하고 요약과 함께 반환한다", async () => {
		// Given - size=2 페이지, 연도 전체는 연속 3주 완벽 달성
		repository.findByYear.mockResolvedValue([buildRow(3), buildRow(2), buildRow(1)]);
		repository.findAllByYear.mockResolvedValue([buildRow(1), buildRow(2), buildRow(3)]);

		// When
		const result = await useCase.execute({
			userId: "user-123",
			year: 2026,
			cursor: undefined,
			size: 2,
			locale: "ko",
		});

		// Then - 목록은 정규화된 take(size+1=3)로, 요약은 연도 전체로 조회
		expect(repository.findByYear).toHaveBeenCalledWith("user-123", 2026, undefined, 3);
		expect(repository.findAllByYear).toHaveBeenCalledWith("user-123", 2026);

		// 초과분(1개)을 잘라내고 hasNext=true, nextCursor=마지막 노출 주차(2)
		expect(result.items.map((i) => i.week)).toEqual([3, 2]);
		expect(result.pagination).toEqual({
			nextCursor: 2,
			hasNext: true,
			size: 2,
		});
		// 연속 3주 완벽 달성 → perfect 3, streak 3, 평균 100
		expect(result.summary).toEqual({
			totalWeeks: 3,
			perfectWeeks: 3,
			currentStreak: 3,
			bestStreak: 3,
			averageRate: 100,
		});
	});

	it("마지막 페이지는 hasNext=false, nextCursor=null이다", async () => {
		// Given - size=2, 정확히 2개(초과분 없음)
		repository.findByYear.mockResolvedValue([buildRow(2), buildRow(1)]);
		repository.findAllByYear.mockResolvedValue([buildRow(1), buildRow(2)]);

		// When
		const result = await useCase.execute({
			userId: "user-123",
			year: 2026,
			cursor: undefined,
			size: 2,
			locale: "ko",
		});

		// Then
		expect(result.items.map((i) => i.week)).toEqual([2, 1]);
		expect(result.pagination).toEqual({
			nextCursor: null,
			hasNext: false,
			size: 2,
		});
	});

	it("기록이 없는 연도는 빈 목록·null 커서·0 요약을 반환한다 (empty-week shape)", async () => {
		// Given - size 미지정(기본 20), 목록·연도 기록 모두 비어 있음
		repository.findByYear.mockResolvedValue([]);
		repository.findAllByYear.mockResolvedValue([]);

		// When
		const result = await useCase.execute({
			userId: "user-123",
			year: 2026,
			cursor: undefined,
			size: undefined,
			locale: "ko",
		});

		// Then
		expect(result.items).toEqual([]);
		expect(result.pagination).toEqual({
			nextCursor: null,
			hasNext: false,
			size: 20,
		});
		expect(result.summary).toEqual({
			totalWeeks: 0,
			perfectWeeks: 0,
			currentStreak: 0,
			bestStreak: 0,
			averageRate: 0,
		});
	});
});
