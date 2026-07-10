/**
 * WeeklyAchievement 통합 테스트 (Mock DB)
 *
 * @description
 * Facade → QueryBus → 핸들러 → Prisma 어댑터의 수직 배선이 PaginationService·
 * UnitOfWork와 함께 올바르게 작동하는지 검증합니다. 실제 DB 대신 모킹된
 * DatabaseService를 TransactionHost.tx로 주입합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입과 CQRS 버스 배선 검증
 * - Facade → 핸들러 → 어댑터 통합 검증
 * - PaginationService 커서 페이지네이션 및 summary 계산 검증
 * - ApplicationException 에러 처리 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test weekly-achievement.integration-spec
 * ```
 */

import { CqrsModule } from "@nestjs/cqrs";
import { Test, type TestingModule } from "@nestjs/testing";
import { TransactionHost } from "@nestjs-cls/transactional";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { suppressLogger } from "@test/setup/suppress-logger";
import { PaginationService } from "@/shared/application/pagination/services/pagination.service";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { WeeklyAchievementFacade } from "@/weekly-achievement/application/facades/weekly-achievement.facade";
import { WEEKLY_ACHIEVEMENT_REPOSITORY } from "@/weekly-achievement/application/ports/weekly-achievement.repository.port";
import { QueryHandlers } from "@/weekly-achievement/application/queries/handlers";
import { PrismaWeeklyAchievementRepository } from "@/weekly-achievement/infrastructure/adapters/prisma-weekly-achievement.repository";

describe("WeeklyAchievement 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let facade: WeeklyAchievementFacade;

	// Mock 데이터베이스 서비스
	const mockWeeklyAchievementDb = {
		findMany: jest.fn(),
		findFirst: jest.fn(),
		findUnique: jest.fn(),
		upsert: jest.fn(),
	};

	const mockDatabaseService = createMockDatabaseService({
		weeklyAchievement: mockWeeklyAchievementDb,
	});

	// 테스트 데이터
	const mockUserId = "user-weekly-123";
	const mockYear = 2026;

	function createWeeklyAchievement(overrides: {
		id?: number;
		week: number;
		totalTodos: number;
		completedTodos: number;
	}) {
		return {
			id: overrides.id ?? overrides.week,
			userId: mockUserId,
			year: mockYear,
			week: overrides.week,
			totalTodos: overrides.totalTodos,
			completedTodos: overrides.completedTodos,
			achievedAt: new Date("2026-03-15T00:00:00.000Z"),
			createdAt: new Date(),
			updatedAt: new Date(),
		};
	}

	beforeAll(async () => {
		suppressLogger();

		// 클린아키 수직 배선: Facade → QueryBus → 핸들러 → Prisma 어댑터(mock DB)
		module = await Test.createTestingModule({
			imports: [CqrsModule.forRoot()],
			providers: [
				WeeklyAchievementFacade,
				...QueryHandlers,
				PaginationService,
				{
					provide: WEEKLY_ACHIEVEMENT_REPOSITORY,
					useClass: PrismaWeeklyAchievementRepository,
				},
				{
					// 어댑터는 TransactionHost.tx에서 클라이언트를 읽습니다 (mock DB 전달)
					provide: TransactionHost,
					useValue: { tx: mockDatabaseService },
				},
				{
					provide: UNIT_OF_WORK,
					useValue: createUnitOfWorkMock(),
				},
			],
		}).compile();

		await module.init();
		facade = module.get(WeeklyAchievementFacade);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("목록 조회 통합 테스트", () => {
		it("목록 조회 — 연도별 주간 달성 현황이 반환된다", async () => {
			// Given - 주간 달성 데이터 준비
			const items = [
				createWeeklyAchievement({
					id: 3,
					week: 12,
					totalTodos: 10,
					completedTodos: 8,
				}),
				createWeeklyAchievement({
					id: 2,
					week: 11,
					totalTodos: 7,
					completedTodos: 7,
				}),
			];
			const yearRecords = [
				createWeeklyAchievement({
					id: 1,
					week: 10,
					totalTodos: 5,
					completedTodos: 3,
				}),
				createWeeklyAchievement({
					id: 2,
					week: 11,
					totalTodos: 7,
					completedTodos: 7,
				}),
				createWeeklyAchievement({
					id: 3,
					week: 12,
					totalTodos: 10,
					completedTodos: 8,
				}),
			];

			mockWeeklyAchievementDb.findMany
				.mockResolvedValueOnce(items)
				.mockResolvedValueOnce(yearRecords);

			// When - 목록 조회
			const result = await facade.getWeeklyAchievements(
				mockUserId,
				mockYear,
				undefined,
				20,
				"ko",
			);

			// Then - 목록 및 summary가 반환되어야 함
			expect(result.items).toHaveLength(2);
			expect(result.summary).toBeDefined();
			expect(result.pagination).toBeDefined();
		});

		it("목록 조회 — summary에 streak/averageRate이 올바르게 계산된다", async () => {
			// Given - 연속 주차 달성 데이터 (10, 11, 12주차 연속)
			const yearRecords = [
				createWeeklyAchievement({
					id: 1,
					week: 10,
					totalTodos: 5,
					completedTodos: 5,
				}),
				createWeeklyAchievement({
					id: 2,
					week: 11,
					totalTodos: 10,
					completedTodos: 10,
				}),
				createWeeklyAchievement({
					id: 3,
					week: 12,
					totalTodos: 8,
					completedTodos: 4,
				}),
			];

			mockWeeklyAchievementDb.findMany
				.mockResolvedValueOnce(yearRecords)
				.mockResolvedValueOnce(yearRecords);

			// When - 목록 조회
			const result = await facade.getWeeklyAchievements(
				mockUserId,
				mockYear,
				undefined,
				20,
				"ko",
			);

			// Then - summary 계산 검증
			expect(result.summary.totalWeeks).toBe(3);
			expect(result.summary.perfectWeeks).toBe(2);
			expect(result.summary.currentStreak).toBe(3);
			expect(result.summary.bestStreak).toBe(3);
			// averageRate = (100 + 100 + 50) / 3 = 83
			expect(result.summary.averageRate).toBe(83);
		});

		it("목록 조회 — 다음 페이지 커서가 올바르게 설정된다", async () => {
			// Given - size보다 1개 더 많은 아이템 (hasNext = true)
			const items = [
				createWeeklyAchievement({
					id: 3,
					week: 12,
					totalTodos: 5,
					completedTodos: 5,
				}),
				createWeeklyAchievement({
					id: 2,
					week: 11,
					totalTodos: 5,
					completedTodos: 5,
				}),
				createWeeklyAchievement({
					id: 1,
					week: 10,
					totalTodos: 5,
					completedTodos: 5,
				}),
			];
			const yearRecords = items;

			mockWeeklyAchievementDb.findMany
				.mockResolvedValueOnce(items)
				.mockResolvedValueOnce(yearRecords);

			// When - size=2로 조회 (3개 반환 → hasNext = true)
			const result = await facade.getWeeklyAchievements(
				mockUserId,
				mockYear,
				undefined,
				2,
				"ko",
			);

			// Then - 다음 페이지 커서가 설정되어야 함
			expect(result.pagination.hasNext).toBe(true);
			expect(result.pagination.nextCursor).toBe(11);
			expect(result.items).toHaveLength(2);
		});
	});

	describe("상세 조회 통합 테스트", () => {
		it("상세 조회 — 특정 주차의 달성 현황이 반환된다", async () => {
			// Given - 특정 주차 데이터
			const mockAchievement = createWeeklyAchievement({
				id: 1,
				week: 10,
				totalTodos: 8,
				completedTodos: 6,
			});
			mockWeeklyAchievementDb.findUnique.mockResolvedValue(mockAchievement);

			// When - 상세 조회
			const result = await facade.getWeeklyAchievement(
				mockUserId,
				mockYear,
				10,
				"ko",
			);

			// Then - 해당 주차 데이터가 반환되어야 함
			expect(result.year).toBe(mockYear);
			expect(result.week).toBe(10);
			expect(result.totalTodos).toBe(8);
			expect(result.completedTodos).toBe(6);
			expect(result.completionRate).toBe(75);
		});

		it("상세 조회 — 존재하지 않는 주차는 에러를 반환한다", async () => {
			// Given - 존재하지 않는 주차
			mockWeeklyAchievementDb.findUnique.mockResolvedValue(null);

			// When & Then - 에러 발생 검증
			await expect(
				facade.getWeeklyAchievement(mockUserId, mockYear, 99, "ko"),
			).rejects.toThrow(ApplicationException);
		});
	});
});
