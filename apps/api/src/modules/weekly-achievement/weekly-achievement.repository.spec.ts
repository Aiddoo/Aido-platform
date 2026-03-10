import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DatabaseService } from "@/database";

import { WeeklyAchievementRepository } from "./weekly-achievement.repository";

describe("WeeklyAchievementRepository", () => {
	let repository: WeeklyAchievementRepository;
	let db: Mocked<DatabaseService>;

	const userId = "user-123";

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			WeeklyAchievementRepository,
		).compile();

		repository = unit;
		db = unitRef.get(DatabaseService);
	});

	// ============================================
	// findByYear
	// ============================================

	describe("findByYear", () => {
		it("커서 없이 연도별 기록을 조회한다", async () => {
			// Given
			const mockRecords = [{ id: 42 }];
			db.weeklyAchievement.findMany.mockResolvedValue(mockRecords as never);

			// When
			await repository.findByYear(userId, 2026, undefined, 21);

			// Then
			expect(db.weeklyAchievement.findMany).toHaveBeenCalledWith({
				where: { userId, year: 2026 },
				orderBy: { id: "desc" },
				take: 21,
			});
		});

		it("커서가 있으면 skip+cursor 옵션을 포함한다", async () => {
			// Given
			db.weeklyAchievement.findMany.mockResolvedValue([] as never);

			// When
			await repository.findByYear(userId, 2026, 42, 21);

			// Then
			expect(db.weeklyAchievement.findMany).toHaveBeenCalledWith({
				where: { userId, year: 2026 },
				orderBy: { id: "desc" },
				take: 21,
				skip: 1,
				cursor: { id: 42 },
			});
		});
	});

	// ============================================
	// findAllByYear
	// ============================================

	describe("findAllByYear", () => {
		it("해당 연도의 기록을 week 오름차순으로 조회한다", async () => {
			// Given
			db.weeklyAchievement.findMany.mockResolvedValue([] as never);

			// When
			await repository.findAllByYear(userId, 2026);

			// Then
			expect(db.weeklyAchievement.findMany).toHaveBeenCalledWith({
				where: { userId, year: 2026 },
				orderBy: [{ week: "asc" }],
			});
		});
	});

	// ============================================
	// findByYearAndWeek
	// ============================================

	describe("findByYearAndWeek", () => {
		it("unique 제약 조건으로 조회한다", async () => {
			// Given
			db.weeklyAchievement.findUnique.mockResolvedValue(null as never);

			// When
			await repository.findByYearAndWeek(userId, 2026, 10);

			// Then
			expect(db.weeklyAchievement.findUnique).toHaveBeenCalledWith({
				where: {
					userId_year_week: { userId, year: 2026, week: 10 },
				},
			});
		});
	});

	// ============================================
	// upsert
	// ============================================

	describe("upsert", () => {
		it("주간 달성 기록을 upsert한다", async () => {
			// Given
			const achievedAt = new Date("2026-03-08T11:00:00.000Z");
			db.weeklyAchievement.upsert.mockResolvedValue({} as never);

			// When
			await repository.upsert({
				userId,
				year: 2026,
				week: 10,
				totalTodos: 15,
				completedTodos: 14,
				achievedAt,
			});

			// Then
			expect(db.weeklyAchievement.upsert).toHaveBeenCalledWith({
				where: {
					userId_year_week: { userId, year: 2026, week: 10 },
				},
				create: {
					userId,
					year: 2026,
					week: 10,
					totalTodos: 15,
					completedTodos: 14,
					achievedAt,
				},
				update: {
					totalTodos: 15,
					completedTodos: 14,
					achievedAt,
				},
			});
		});
	});

	// ============================================
	// upsertMany
	// ============================================

	describe("upsertMany", () => {
		it("여러 기록을 트랜잭션으로 일괄 upsert한다", async () => {
			// Given
			const achievedAt = new Date("2026-03-08T11:00:00.000Z");
			db.$transaction.mockResolvedValue([] as never);

			const paramsList = [
				{
					userId: "user-1",
					year: 2026,
					week: 10,
					totalTodos: 15,
					completedTodos: 14,
					achievedAt,
				},
				{
					userId: "user-2",
					year: 2026,
					week: 10,
					totalTodos: 8,
					completedTodos: 8,
					achievedAt,
				},
			];

			// When
			await repository.upsertMany(paramsList);

			// Then
			expect(db.$transaction).toHaveBeenCalledTimes(1);
			expect(db.$transaction).toHaveBeenCalledWith(expect.any(Array));
		});

		it("빈 배열이면 $transaction을 호출하지 않는다", async () => {
			// When
			await repository.upsertMany([]);

			// Then
			expect(db.$transaction).not.toHaveBeenCalled();
		});
	});
});
