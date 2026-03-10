import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { NormalizedCursorPagination } from "@/common/pagination";
import { PaginationService } from "@/common/pagination";
import type { WeeklyAchievement } from "@/generated/prisma/client";

import { WeeklyAchievementRepository } from "./weekly-achievement.repository";
import { WeeklyAchievementService } from "./weekly-achievement.service";

describe("WeeklyAchievementService", () => {
	let service: WeeklyAchievementService;
	let repository: Mocked<WeeklyAchievementRepository>;
	let paginationService: Mocked<PaginationService>;

	const mockUserId = "user-123";

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			WeeklyAchievementService,
		).compile();

		service = unit;
		repository = unitRef.get(WeeklyAchievementRepository);
		paginationService = unitRef.get(PaginationService);

		// 기본 mock 설정
		paginationService.normalizeCursorPagination.mockReturnValue({
			cursor: undefined,
			size: 20,
			take: 21,
		} as NormalizedCursorPagination<number>);
	});

	// ============================================
	// getWeeklyAchievements
	// ============================================

	describe("getWeeklyAchievements", () => {
		const mockItems: WeeklyAchievement[] = [
			{
				id: 42,
				userId: mockUserId,
				year: 2026,
				week: 10,
				totalTodos: 15,
				completedTodos: 14,
				achievedAt: new Date("2026-03-08T11:00:00.000Z"),
				createdAt: new Date("2026-03-08T11:00:00.000Z"),
			},
		];

		beforeEach(() => {
			repository.findByYear.mockResolvedValue(mockItems);
			repository.findAllByYear.mockResolvedValue(mockItems);
		});

		it("페이지네이션 목록과 summary를 반환한다", async () => {
			// When
			const result = await service.getWeeklyAchievements({
				userId: mockUserId,
				year: 2026,
				size: 20,
			});

			// Then
			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				id: 42,
				year: 2026,
				week: 10,
			});
			expect(result.pagination).toEqual({
				nextCursor: null,
				hasNext: false,
				size: 20,
			});
			expect(result.summary).toMatchObject({
				totalWeeks: expect.any(Number),
				perfectWeeks: expect.any(Number),
				currentStreak: expect.any(Number),
				bestStreak: expect.any(Number),
				averageRate: expect.any(Number),
			});
		});

		it("PaginationService를 올바르게 호출한다", async () => {
			// When
			await service.getWeeklyAchievements({
				userId: mockUserId,
				year: 2026,
				cursor: 10,
				size: 5,
			});

			// Then
			expect(paginationService.normalizeCursorPagination).toHaveBeenCalledWith({
				cursor: 10,
				size: 5,
			});
		});

		it("목록 조회와 연도별 전체 조회를 병렬로 실행한다", async () => {
			// When
			await service.getWeeklyAchievements({
				userId: mockUserId,
				year: 2026,
				size: 20,
			});

			// Then
			expect(repository.findByYear).toHaveBeenCalledWith(
				mockUserId,
				2026,
				undefined,
				21,
			);
			expect(repository.findAllByYear).toHaveBeenCalledWith(mockUserId, 2026);
		});
	});

	// ============================================
	// getWeeklyAchievement
	// ============================================

	describe("getWeeklyAchievement", () => {
		it("존재하는 기록을 DTO로 반환한다", async () => {
			// Given
			const entity: WeeklyAchievement = {
				id: 42,
				userId: mockUserId,
				year: 2026,
				week: 10,
				totalTodos: 15,
				completedTodos: 14,
				achievedAt: new Date("2026-03-08T11:00:00.000Z"),
				createdAt: new Date("2026-03-08T11:00:00.000Z"),
			};
			repository.findByYearAndWeek.mockResolvedValue(entity);

			// When
			const result = await service.getWeeklyAchievement({
				userId: mockUserId,
				year: 2026,
				week: 10,
			});

			// Then
			expect(result).toMatchObject({
				id: 42,
				year: 2026,
				week: 10,
				completionRate: 93,
			});
		});

		it("기록이 없으면 BusinessException을 던진다", async () => {
			// Given
			repository.findByYearAndWeek.mockResolvedValue(null);

			// When/Then
			await expect(
				service.getWeeklyAchievement({
					userId: mockUserId,
					year: 2026,
					week: 99,
				}),
			).rejects.toThrow(BusinessExceptions.weeklyAchievementNotFound(2026, 99));
		});
	});

	// ============================================
	// upsertMany
	// ============================================

	describe("upsertMany", () => {
		it("Repository.upsertMany에 위임한다", async () => {
			// Given
			const paramsList = [
				{
					userId: "user-1",
					year: 2026,
					week: 10,
					totalTodos: 15,
					completedTodos: 14,
					achievedAt: new Date("2026-03-08T11:00:00.000Z"),
				},
			];
			repository.upsertMany.mockResolvedValue(undefined);

			// When
			await service.upsertMany(paramsList);

			// Then
			expect(repository.upsertMany).toHaveBeenCalledWith(paramsList);
		});
	});
});
