/**
 * DailyCompletion 통합 테스트 (Testcontainers)
 *
 * @description
 * DailyCompletionFacade → use-case → Prisma 어댑터가 실제 PostgreSQL DB와
 * 함께 올바르게 작동하는지 검증합니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 컨테이너에서 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - Facade → use-case → Prisma 어댑터 → PostgreSQL 전체 스택 검증
 * - 날짜별 Todo 집계 로직 검증
 * - 캘린더 데이터 조회 검증
 *
 * 실행 조건:
 * - Docker가 실행 중이어야 함 (Testcontainers 사용)
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test daily-completion.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { TransactionHost } from "@nestjs-cls/transactional";
import { suppressLogger } from "@test/setup/suppress-logger";
import dayjs from "dayjs";
import { DailyCompletionFacade } from "@/daily-completion/application/facades/daily-completion.facade";
import { DAILY_COMPLETION_CACHE } from "@/daily-completion/application/ports/daily-completion-cache.port";
import { TODO_COMPLETION_REPOSITORY } from "@/daily-completion/application/ports/todo-completion.repository.port";
import { DailyCompletionQueryUseCases } from "@/daily-completion/application/queries";
import { PrismaTodoCompletionRepository } from "@/daily-completion/infrastructure/adapters/prisma-todo-completion.repository";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { TestDatabase } from "../setup/test-database";

describe("DailyCompletion 통합 테스트 (실제 DB)", () => {
	let module: TestingModule;
	let facade: DailyCompletionFacade;
	let repository: PrismaTodoCompletionRepository;
	let testDb: TestDatabase;
	let databaseService: DatabaseService;

	// 테스트 스위트 시작 시 한 번만 실행
	beforeAll(async () => {
		suppressLogger();

		// TestContainer 시작 및 Database 연결
		testDb = new TestDatabase();
		databaseService = (await testDb.start()) as DatabaseService;

		// 클린아키 수직 배선: Facade → use-case → Prisma 어댑터(실제 DB)
		module = await Test.createTestingModule({
			providers: [
				DailyCompletionFacade,
				...DailyCompletionQueryUseCases,
				{
					provide: TODO_COMPLETION_REPOSITORY,
					useClass: PrismaTodoCompletionRepository,
				},
				{
					// 어댑터는 TransactionHost.tx에서 클라이언트를 읽습니다 (실제 Prisma 전달)
					provide: TransactionHost,
					useValue: { tx: databaseService },
				},
				{
					// 통합 테스트는 DB 경로를 검증하므로 캐시는 항상 미스인 no-op 스텁
					provide: DAILY_COMPLETION_CACHE,
					useValue: {
						getRange: async () => undefined,
						setRange: async () => undefined,
						invalidate: async () => undefined,
					},
				},
			],
		}).compile();

		await module.init();
		facade = module.get(DailyCompletionFacade);
		repository = module.get(TODO_COMPLETION_REPOSITORY);
	}, 60000); // 컨테이너 시작에 시간이 걸릴 수 있음

	// 각 테스트 전 데이터 초기화
	beforeEach(async () => {
		jest.clearAllMocks();
		await testDb.cleanup();
	});

	// 테스트 스위트 종료 시 정리
	afterAll(async () => {
		try {
			if (module) {
				await module.close();
			}
		} finally {
			if (testDb) {
				await testDb.stop();
			}
		}
	});

	/**
	 * 테스트용 사용자 생성 (기본 카테고리 포함)
	 */
	async function createTestUser(
		email = "test@example.com",
	): Promise<{ id: string; defaultCategoryId: number }> {
		// userTag는 8자리 제한 (VarChar(8))
		const userTag = Date.now().toString(36).toUpperCase().slice(-8);
		const user = await databaseService.user.create({
			data: {
				email,
				status: "ACTIVE",
				userTag,
				profile: {
					create: {
						name: "Test User",
					},
				},
			},
		});

		// 기본 카테고리 생성
		const category = await databaseService.todoCategory.create({
			data: {
				userId: user.id,
				name: "할 일",
				color: "#FF6B43",
				sortOrder: 0,
			},
		});

		return { id: user.id, defaultCategoryId: category.id };
	}

	/**
	 * 테스트용 Todo 생성
	 * @param userId - 사용자 ID
	 * @param categoryId - 카테고리 ID
	 * @param startDate - 시작 날짜 (문자열 "YYYY-MM-DD" 또는 Date)
	 * @param completed - 완료 여부
	 */
	async function createTestTodo(
		userId: string,
		categoryId: number,
		startDate: string | Date,
		completed = false,
	): Promise<{ id: number }> {
		// 문자열인 경우 UTC 자정으로 변환
		const dateValue =
			typeof startDate === "string"
				? dayjs.utc(startDate).startOf("day").toDate()
				: startDate;

		return databaseService.todo.create({
			data: {
				userId,
				categoryId,
				title: `Test Todo ${Date.now()}`,
				startDate: dateValue,
				completed,
			},
		});
	}

	/**
	 * 특정 날짜에 여러 Todo 생성
	 * @param userId - 사용자 ID
	 * @param categoryId - 카테고리 ID
	 * @param date - 날짜 문자열 "YYYY-MM-DD"
	 * @param total - 총 Todo 수
	 * @param completed - 완료된 Todo 수
	 */
	async function createTodosForDate(
		userId: string,
		categoryId: number,
		date: string,
		total: number,
		completed: number,
	): Promise<void> {
		const promises = [];
		for (let i = 0; i < total; i++) {
			promises.push(createTestTodo(userId, categoryId, date, i < completed));
		}
		await Promise.all(promises);
	}

	describe("배선 확인", () => {
		it("facade가 정의되어 있어야 한다", () => {
			// Given - DI 컨테이너가 구성됨

			// When - Facade 인스턴스 확인

			// Then - Facade가 정의되어 있어야 함
			expect(facade).toBeDefined();
		});

		it("repository가 연결되어 있어야 한다", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 레포지토리 인스턴스 확인

			// Then - 레포지토리가 정의되어 있어야 함
			expect(repository).toBeDefined();
		});
	});

	describe("DailyCompletionRepository.aggregateByDateRange", () => {
		it("날짜 범위 내 Todo를 날짜별로 집계해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-15",
				3,
				2,
			);
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-16",
				2,
				2,
			);

			// When
			const result = await repository.aggregateByDateRange({
				userId: user.id,
				startDate: new Date("2026-01-01"),
				endDate: new Date("2026-02-01"),
			});

			// Then
			expect(result).toHaveLength(2);

			const day15 = result.find((r) =>
				r.date.toISOString().includes("2026-01-15"),
			);
			const day16 = result.find((r) =>
				r.date.toISOString().includes("2026-01-16"),
			);

			expect(day15?.total).toBe(3);
			expect(day15?.completed).toBe(2);
			expect(day16?.total).toBe(2);
			expect(day16?.completed).toBe(2);
		});

		it("다른 사용자의 Todo는 포함하지 않아야 한다", async () => {
			// Given - 두 사용자가 같은 날짜에 Todo를 가짐
			const user1 = await createTestUser("user1@example.com");
			const user2 = await createTestUser("user2@example.com");
			await createTodosForDate(
				user1.id,
				user1.defaultCategoryId,
				"2026-01-15",
				3,
				3,
			);
			await createTodosForDate(
				user2.id,
				user2.defaultCategoryId,
				"2026-01-15",
				5,
				1,
			);

			// When - user1의 Todo만 집계
			const result = await repository.aggregateByDateRange({
				userId: user1.id,
				startDate: new Date("2026-01-01"),
				endDate: new Date("2026-02-01"),
			});

			// Then - user1의 Todo만 반환
			expect(result).toHaveLength(1);
			expect(result[0]?.total).toBe(3);
			expect(result[0]?.completed).toBe(3);
		});

		it("날짜 범위 외의 Todo는 포함하지 않아야 한다", async () => {
			// Given - 범위 내외에 각각 Todo가 있음
			const user = await createTestUser();
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2025-12-31",
				2,
				1,
			);
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-15",
				3,
				2,
			);
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-02-01",
				1,
				1,
			);

			// When - 1월 범위만 조회
			const result = await repository.aggregateByDateRange({
				userId: user.id,
				startDate: new Date("2026-01-01"),
				endDate: new Date("2026-02-01"),
			});

			// Then - 범위 내 Todo만 반환
			expect(result).toHaveLength(1);
			expect(result[0]?.total).toBe(3);
		});

		it("Todo가 없으면 빈 배열을 반환해야 한다", async () => {
			// Given - Todo가 없는 사용자
			const user = await createTestUser();

			// When - 날짜 범위로 집계 조회
			const result = await repository.aggregateByDateRange({
				userId: user.id,
				startDate: new Date("2026-01-01"),
				endDate: new Date("2026-02-01"),
			});

			// Then - 빈 배열 반환
			expect(result).toEqual([]);
		});
	});

	describe("일일 완료 조회 (Facade)", () => {
		it("날짜 범위 내 완료 현황을 반환해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-15",
				3,
				3,
			); // 완료
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-16",
				2,
				1,
			); // 미완료

			// When
			const result = await facade.getDailyCompletions(
				user.id,
				"2026-01-01",
				"2026-01-31",
			);

			// Then
			expect(result.completions).toHaveLength(2);
			expect(result.totalCompleteDays).toBe(1);
			expect(result.dateRange).toEqual({
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			});
		});

		it("완료율을 정확히 계산해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-15",
				4,
				3,
			); // 75%

			// When
			const result = await facade.getDailyCompletions(
				user.id,
				"2026-01-01",
				"2026-01-31",
			);

			// Then
			const day15 = result.completions.find((c) => c.date === "2026-01-15");
			expect(day15?.completionRate).toBe(75);
			expect(day15?.isComplete).toBe(false);
		});

		it("모든 Todo 완료 시 isComplete가 true여야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-15",
				5,
				5,
			);

			// When
			const result = await facade.getDailyCompletions(
				user.id,
				"2026-01-01",
				"2026-01-31",
			);

			// Then
			const day15 = result.completions.find((c) => c.date === "2026-01-15");
			expect(day15?.isComplete).toBe(true);
			expect(day15?.completionRate).toBe(100);
		});

		it("결과를 날짜순으로 정렬해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-20",
				1,
				1,
			);
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-10",
				2,
				1,
			);
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-15",
				3,
				2,
			);

			// When
			const result = await facade.getDailyCompletions(
				user.id,
				"2026-01-01",
				"2026-01-31",
			);

			// Then
			expect(result.completions[0]?.date).toBe("2026-01-10");
			expect(result.completions[1]?.date).toBe("2026-01-15");
			expect(result.completions[2]?.date).toBe("2026-01-20");
		});

		it("Todo가 없으면 빈 결과를 반환해야 한다", async () => {
			// Given - Todo가 없는 사용자
			const user = await createTestUser();

			// When - 완료 현황 조회
			const result = await facade.getDailyCompletions(
				user.id,
				"2026-01-01",
				"2026-01-31",
			);

			// Then - 빈 결과 반환
			expect(result.completions).toEqual([]);
			expect(result.totalCompleteDays).toBe(0);
		});
	});

	describe("경계 조건", () => {
		it("월 경계를 정확히 처리해야 한다", async () => {
			// Given - 1월 마지막 날과 2월 첫 날에 Todo가 있음
			const user = await createTestUser();
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-31",
				2,
				2,
			);
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-02-01",
				3,
				1,
			);

			// When - 1월만 조회
			const janResult = await facade.getDailyCompletions(
				user.id,
				"2026-01-01",
				"2026-01-31",
			);

			// Then - 1월 데이터만 반환
			expect(janResult.completions).toHaveLength(1);
			expect(janResult.completions[0]?.date).toBe("2026-01-31");

			// When - 2월만 조회
			const febResult = await facade.getDailyCompletions(
				user.id,
				"2026-02-01",
				"2026-02-28",
			);

			// Then - 2월 데이터만 반환
			expect(febResult.completions).toHaveLength(1);
			expect(febResult.completions[0]?.date).toBe("2026-02-01");
		});

		it("하루 동안의 여러 Todo를 정확히 집계해야 한다", async () => {
			// Given - 같은 날짜에 10개 Todo (7개 완료)
			const user = await createTestUser();
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-15",
				10,
				7,
			);

			// When - 해당 날짜 조회
			const result = await facade.getDailyCompletions(
				user.id,
				"2026-01-15",
				"2026-01-15",
			);

			// Then - 정확한 집계 결과 반환
			expect(result.completions).toHaveLength(1);
			expect(result.completions[0]?.totalTodos).toBe(10);
			expect(result.completions[0]?.completedTodos).toBe(7);
			expect(result.completions[0]?.completionRate).toBe(70);
		});

		it("완료된 Todo가 0개인 날도 정확히 처리해야 한다", async () => {
			// Given - 완료된 Todo가 없는 날
			const user = await createTestUser();
			await createTodosForDate(
				user.id,
				user.defaultCategoryId,
				"2026-01-15",
				5,
				0,
			);

			// When - 완료 현황 조회
			const result = await facade.getDailyCompletions(
				user.id,
				"2026-01-01",
				"2026-01-31",
			);

			// Then - 0% 완료율 반환
			const day15 = result.completions.find((c) => c.date === "2026-01-15");
			expect(day15?.totalTodos).toBe(5);
			expect(day15?.completedTodos).toBe(0);
			expect(day15?.completionRate).toBe(0);
			expect(day15?.isComplete).toBe(false);
		});
	});

	describe("대량 데이터 처리", () => {
		it("한 달 전체 데이터를 효율적으로 처리해야 한다", async () => {
			// Given - 한 달 동안 매일 3개씩 Todo 생성
			const user = await createTestUser();
			const promises = [];
			for (let day = 1; day <= 31; day++) {
				const dateStr = `2026-01-${String(day).padStart(2, "0")}`;
				promises.push(
					createTodosForDate(
						user.id,
						user.defaultCategoryId,
						dateStr,
						3,
						day % 4,
					),
				);
			}
			await Promise.all(promises);

			// When - 한 달 전체 조회
			const startTime = Date.now();
			const result = await facade.getDailyCompletions(
				user.id,
				"2026-01-01",
				"2026-01-31",
			);
			const duration = Date.now() - startTime;

			// Then - 31일 데이터가 5초 이내에 반환됨
			expect(result.completions).toHaveLength(31);
			expect(duration).toBeLessThan(5000);
		});
	});
});
