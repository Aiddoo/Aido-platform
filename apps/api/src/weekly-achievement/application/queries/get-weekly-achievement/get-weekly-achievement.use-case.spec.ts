/**
 * GetWeeklyAchievementUseCase 단위 테스트
 *
 * - (userId, year, week)로 단건 조회 후 응답 뷰(라벨·날짜범위·완료율)로 변환
 * - 없으면 ACHIEVEMENT_1801 (year/week 컨텍스트 포함)
 * - 라벨/날짜범위는 로케일에 따라 도메인 규칙(ISO 주차 목요일 기준)으로 계산된다
 */
import { ErrorCode } from "@aido/errors";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createWeeklyAchievementRepositoryMock } from "@test/mocks/ports/weekly-achievement.mock";
import type { WeeklyAchievementRow } from "../../../domain/weekly-achievement";
import {
	WEEKLY_ACHIEVEMENT_REPOSITORY,
	type WeeklyAchievementRepositoryPort,
} from "../../ports/weekly-achievement.repository.port";
import { GetWeeklyAchievementUseCase } from "./get-weekly-achievement.use-case";

// 2026 ISO week 10 → 3월 1주차 / "Week 1 of Mar", 2026-03-02 ~ 2026-03-08 (도메인 규칙 실측)
function buildRow(): WeeklyAchievementRow {
	return {
		id: 1,
		year: 2026,
		week: 10,
		totalTodos: 10,
		completedTodos: 7,
		achievedAt: new Date("2026-03-09T00:00:00.000Z"),
	};
}

describe("GetWeeklyAchievementUseCase — 특정 연도/주차 주간 달성 상세 조회", () => {
	let useCase: GetWeeklyAchievementUseCase;
	let repository: Mocked<WeeklyAchievementRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			GetWeeklyAchievementUseCase,
		)
			.mock<WeeklyAchievementRepositoryPort>(WEEKLY_ACHIEVEMENT_REPOSITORY)
			.impl(() => createWeeklyAchievementRepositoryMock())
			.compile();

		useCase = unit;
		repository = unitRef.get<WeeklyAchievementRepositoryPort>(
			WEEKLY_ACHIEVEMENT_REPOSITORY,
		);
	});

	it("조회한 레코드를 완료율·라벨·날짜범위가 채워진 뷰로 변환한다 (ko)", async () => {
		// Given
		repository.findByYearAndWeek.mockResolvedValue(buildRow());

		// When
		const result = await useCase.execute({
			userId: "user-123",
			year: 2026,
			week: 10,
			locale: "ko",
		});

		// Then
		expect(repository.findByYearAndWeek).toHaveBeenCalledWith(
			"user-123",
			2026,
			10,
		);
		expect(result).toEqual({
			id: 1,
			year: 2026,
			week: 10,
			weekLabel: "3월 1주차",
			dateRange: { startDate: "2026-03-02", endDate: "2026-03-08" },
			totalTodos: 10,
			completedTodos: 7,
			completionRate: 70,
			achievedAt: "2026-03-09T00:00:00.000Z",
		});
	});

	it("로케일이 en이면 영문 주차 라벨을 생성한다", async () => {
		// Given
		repository.findByYearAndWeek.mockResolvedValue(buildRow());

		// When
		const result = await useCase.execute({
			userId: "user-123",
			year: 2026,
			week: 10,
			locale: "en",
		});

		// Then
		expect(result.weekLabel).toBe("Week 1 of Mar");
	});

	it("레코드가 없으면 ACHIEVEMENT_1801을 던진다", async () => {
		// Given
		repository.findByYearAndWeek.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({
				userId: "user-123",
				year: 2026,
				week: 99,
				locale: "ko",
			}),
		).rejects.toMatchObject({ errorCode: ErrorCode.ACHIEVEMENT_1801 });
	});
});
