/**
 * WeeklyAchievementController 컨트롤러 단위 테스트
 *
 * @description
 * 컨트롤러가 Facade에 올바른 파라미터를 전달하고 응답을 그대로 반환하는지
 * 격리 테스트합니다. Facade는 자동 목으로 대체됩니다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "../../auth/presentation/decorators";
import { GetWeeklyAchievementUseCase } from "../application/queries/get-weekly-achievement/get-weekly-achievement.use-case";
import type { WeeklyAchievementListView } from "../application/queries/get-weekly-achievements/get-weekly-achievements.use-case";
import { GetWeeklyAchievementsUseCase } from "../application/queries/get-weekly-achievements/get-weekly-achievements.use-case";
import { WeeklyAchievementController } from "./weekly-achievement.controller";

describe("WeeklyAchievementController — 주간 성취 컨트롤러", () => {
	let controller: WeeklyAchievementController;
	let getWeeklyAchievementsUseCase: Mocked<GetWeeklyAchievementsUseCase>;
	let getWeeklyAchievementUseCase: Mocked<GetWeeklyAchievementUseCase>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			WeeklyAchievementController,
		).compile();

		controller = unit;
		getWeeklyAchievementsUseCase = unitRef.get(GetWeeklyAchievementsUseCase);
		getWeeklyAchievementUseCase = unitRef.get(GetWeeklyAchievementUseCase);
	});

	describe("getWeeklyAchievements", () => {
		it("Facade에 올바른 파라미터를 전달한다", async () => {
			// Given
			const mockResult: WeeklyAchievementListView = {
				items: [],
				pagination: { nextCursor: null, hasNext: false, size: 20 },
				summary: {
					totalWeeks: 0,
					perfectWeeks: 0,
					currentStreak: 0,
					bestStreak: 0,
					averageRate: 0,
				},
			};
			getWeeklyAchievementsUseCase.execute.mockResolvedValue(mockResult);

			// When
			await controller.getWeeklyAchievements(
				mockUser,
				{ year: 2026, cursor: 10, size: 5 },
				undefined,
			);

			// Then
			expect(getWeeklyAchievementsUseCase.execute).toHaveBeenCalledWith({
				userId: "user-123",
				year: 2026,
				cursor: 10,
				size: 5,
				locale: "ko",
			});
		});

		it("Facade 응답을 그대로 반환한다", async () => {
			// Given
			const mockResult: WeeklyAchievementListView = {
				items: [
					{
						id: 42,
						year: 2026,
						week: 10,
						weekLabel: "3월 2주차",
						dateRange: { startDate: "2026-03-02", endDate: "2026-03-08" },
						totalTodos: 15,
						completedTodos: 14,
						completionRate: 93,
						achievedAt: "2026-03-08T11:00:00.000Z",
					},
				],
				pagination: { nextCursor: null, hasNext: false, size: 20 },
				summary: {
					totalWeeks: 1,
					perfectWeeks: 0,
					currentStreak: 1,
					bestStreak: 1,
					averageRate: 93,
				},
			};
			getWeeklyAchievementsUseCase.execute.mockResolvedValue(mockResult);

			// When
			const result = await controller.getWeeklyAchievements(
				mockUser,
				{ year: 2026, size: 20 },
				undefined,
			);

			// Then
			expect(result).toEqual(mockResult);
		});
	});

	describe("getWeeklyAchievement", () => {
		it("Facade에 올바른 파라미터를 전달한다", async () => {
			// Given
			getWeeklyAchievementUseCase.execute.mockResolvedValue({
				id: 42,
				year: 2026,
				week: 10,
				weekLabel: "3월 2주차",
				dateRange: { startDate: "2026-03-02", endDate: "2026-03-08" },
				totalTodos: 15,
				completedTodos: 14,
				completionRate: 93,
				achievedAt: "2026-03-08T11:00:00.000Z",
			});

			// When
			await controller.getWeeklyAchievement(
				mockUser,
				{ year: 2026, week: 10 },
				undefined,
			);

			// Then
			expect(getWeeklyAchievementUseCase.execute).toHaveBeenCalledWith({
				userId: "user-123",
				year: 2026,
				week: 10,
				locale: "ko",
			});
		});
	});
});
