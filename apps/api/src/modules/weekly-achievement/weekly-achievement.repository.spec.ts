/**
 * WeeklyAchievementRepository 리포지토리 단위 테스트
 *
 * @description
 * WeeklyAchievementRepository의 데이터 접근 메서드를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test weekly-achievement.repository
 * ```
 */
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";
import { createUnitOfWorkMock } from "@test/mocks/ports";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/common/database";
import type { DatabaseService } from "@/database/database.service";

import { WeeklyAchievementRepository } from "./weekly-achievement.repository";

describe("WeeklyAchievementRepository — 주간 성취 리포지토리", () => {
	let repository: WeeklyAchievementRepository;
	let db: MockPrismaClient;
	let uow: UnitOfWorkPort;

	const userId = "user-123";

	beforeEach(async () => {
		// 리포지토리는 CLS TransactionHost.tx에서 클라이언트를 읽으므로
		// tx가 Prisma mock을 반환하도록 스텁합니다.
		db = createMockPrisma();
		uow = createUnitOfWorkMock();

		const { unit } = await TestBed.solitary(WeeklyAchievementRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(
				TransactionHost,
			)
			.impl(() => ({ tx: db }))
			.mock(UNIT_OF_WORK)
			.impl(() => uow)
			.compile();

		repository = unit;
	});

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
				orderBy: { week: "desc" },
				take: 21,
			});
		});

		it("커서가 있으면 복합 unique 커서를 포함한다", async () => {
			// Given
			db.weeklyAchievement.findMany.mockResolvedValue([] as never);

			// When
			await repository.findByYear(userId, 2026, 10, 21);

			// Then
			expect(db.weeklyAchievement.findMany).toHaveBeenCalledWith({
				where: { userId, year: 2026 },
				orderBy: { week: "desc" },
				take: 21,
				skip: 1,
				cursor: { userId_year_week: { userId, year: 2026, week: 10 } },
			});
		});
	});

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

	describe("upsertMany", () => {
		it("여러 기록을 트랜잭션으로 일괄 upsert한다", async () => {
			// Given
			const achievedAt = new Date("2026-03-08T11:00:00.000Z");
			db.weeklyAchievement.upsert.mockResolvedValue({} as never);

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
			expect(jest.mocked(uow.run)).toHaveBeenCalledTimes(1);
			expect(db.weeklyAchievement.upsert).toHaveBeenCalledTimes(2);
			expect(db.weeklyAchievement.upsert).toHaveBeenNthCalledWith(1, {
				where: {
					userId_year_week: { userId: "user-1", year: 2026, week: 10 },
				},
				create: {
					userId: "user-1",
					year: 2026,
					week: 10,
					totalTodos: 15,
					completedTodos: 14,
					achievedAt,
				},
				update: { totalTodos: 15, completedTodos: 14, achievedAt },
			});
		});

		it("빈 배열이면 트랜잭션을 시작하지 않는다", async () => {
			// When
			await repository.upsertMany([]);

			// Then
			expect(jest.mocked(uow.run)).not.toHaveBeenCalled();
			expect(db.weeklyAchievement.upsert).not.toHaveBeenCalled();
		});
	});
});
