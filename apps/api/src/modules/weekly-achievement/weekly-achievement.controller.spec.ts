import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "../auth/decorators";

import { WeeklyAchievementController } from "./weekly-achievement.controller";
import type { WeeklyAchievementListResult } from "./weekly-achievement.service";
import { WeeklyAchievementService } from "./weekly-achievement.service";

describe("WeeklyAchievementController", () => {
	let controller: WeeklyAchievementController;
	let service: Mocked<WeeklyAchievementService>;

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
		service = unitRef.get(WeeklyAchievementService);
	});

	// ============================================
	// getWeeklyAchievements
	// ============================================

	describe("getWeeklyAchievements", () => {
		it("Service에 올바른 파라미터를 전달한다", async () => {
			// Given
			const mockResult: WeeklyAchievementListResult = {
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
			service.getWeeklyAchievements.mockResolvedValue(mockResult);

			// When
			await controller.getWeeklyAchievements(mockUser, {
				year: 2026,
				cursor: 10,
				size: 5,
			});

			// Then
			expect(service.getWeeklyAchievements).toHaveBeenCalledWith({
				userId: "user-123",
				year: 2026,
				cursor: 10,
				size: 5,
			});
		});

		it("Service 응답을 그대로 반환한다", async () => {
			// Given
			const mockResult: WeeklyAchievementListResult = {
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
			service.getWeeklyAchievements.mockResolvedValue(mockResult);

			// When
			const result = await controller.getWeeklyAchievements(mockUser, {
				year: 2026,
				size: 20,
			});

			// Then
			expect(result).toEqual(mockResult);
		});
	});

	// ============================================
	// getWeeklyAchievement
	// ============================================

	describe("getWeeklyAchievement", () => {
		it("Service에 올바른 파라미터를 전달한다", async () => {
			// Given
			service.getWeeklyAchievement.mockResolvedValue({
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
			await controller.getWeeklyAchievement(mockUser, 2026, 10);

			// Then
			expect(service.getWeeklyAchievement).toHaveBeenCalledWith({
				userId: "user-123",
				year: 2026,
				week: 10,
			});
		});
	});
});
