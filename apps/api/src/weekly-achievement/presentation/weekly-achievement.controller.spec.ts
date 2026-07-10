/**
 * WeeklyAchievementController 컨트롤러 단위 테스트
 *
 * @description
 * 컨트롤러가 Facade에 올바른 파라미터를 전달하고 응답을 그대로 반환하는지
 * 격리 테스트합니다. Facade는 자동 목으로 대체됩니다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "../../auth/decorators";
import { WeeklyAchievementFacade } from "../application/facades/weekly-achievement.facade";
import type { WeeklyAchievementListView } from "../application/queries/get-weekly-achievements.query";
import { WeeklyAchievementController } from "./weekly-achievement.controller";

describe("WeeklyAchievementController — 주간 성취 컨트롤러", () => {
	let controller: WeeklyAchievementController;
	let facade: Mocked<WeeklyAchievementFacade>;

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
		facade = unitRef.get(WeeklyAchievementFacade);
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
			facade.getWeeklyAchievements.mockResolvedValue(mockResult);

			// When
			await controller.getWeeklyAchievements(
				mockUser,
				{ year: 2026, cursor: 10, size: 5 },
				undefined,
			);

			// Then
			expect(facade.getWeeklyAchievements).toHaveBeenCalledWith(
				"user-123",
				2026,
				10,
				5,
				"ko",
			);
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
			facade.getWeeklyAchievements.mockResolvedValue(mockResult);

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
			facade.getWeeklyAchievement.mockResolvedValue({
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
			expect(facade.getWeeklyAchievement).toHaveBeenCalledWith(
				"user-123",
				2026,
				10,
				"ko",
			);
		});
	});
});
