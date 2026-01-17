/**
 * DailyCompletion 통합 테스트 (Testcontainers)
 *
 * @description
 * DailyCompletionService와 Repository가 실제 PostgreSQL DB와 함께 올바르게 작동하는지 검증합니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 컨테이너에서 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - DailyCompletionService → Repository → Prisma → PostgreSQL 전체 스택 검증
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
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { DatabaseService } from "@/database/database.service";
import { DailyCompletionRepository } from "@/modules/daily-completion/daily-completion.repository";
import { DailyCompletionService } from "@/modules/daily-completion/daily-completion.service";

// UTC 플러그인 활성화
dayjs.extend(utc);

import { TestDatabase } from "../setup/test-database";

describe("DailyCompletion 통합 테스트 (실제 DB)", () => {
	let module: TestingModule;
	let service: DailyCompletionService;
	let repository: DailyCompletionRepository;
	let testDb: TestDatabase;
	let databaseService: DatabaseService;

	// 테스트 스위트 시작 시 한 번만 실행
	beforeAll(async () => {
		// TestContainer 시작 및 Database 연결
		testDb = new TestDatabase();
		databaseService = (await testDb.start()) as DatabaseService;

		// NestJS 테스트 모듈 생성
		module = await Test.createTestingModule({
			providers: [
				DailyCompletionService,
				DailyCompletionRepository,
				{
					provide: DatabaseService,
					useValue: databaseService,
				},
			],
		}).compile();

		service = module.get<DailyCompletionService>(DailyCompletionService);
		repository = module.get<DailyCompletionRepository>(
			DailyCompletionRepository,
		);
	}, 60000); // 컨테이너 시작에 시간이 걸릴 수 있음

	// 각 테스트 전 데이터 초기화
	beforeEach(async () => {
		await testDb.cleanup();
	});

	// 테스트 스위트 종료 시 정리
	afterAll(async () => {
		if (testDb) {
			await testDb.stop();
		}
		if (module) {
			await module.close();
		}
	});

	// ===========================================================================
	// 테스트 헬퍼 함수
	// ===========================================================================

	/**
	 * 테스트용 사용자 생성
	 */
	async function createTestUser(
		email = "test@example.com",
	): Promise<{ id: string }> {
		// userTag는 8자리 제한 (VarChar(8))
		const userTag = Date.now().toString(36).toUpperCase().slice(-8);
		return databaseService.user.create({
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
	}

	/**
	 * 테스트용 Todo 생성
	 * @param userId - 사용자 ID
	 * @param startDate - 시작 날짜 (문자열 "YYYY-MM-DD" 또는 Date)
	 * @param completed - 완료 여부
	 */
	async function createTestTodo(
		userId: string,
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
				title: `Test Todo ${Date.now()}`,
				startDate: dateValue,
				completed,
			},
		});
	}

	/**
	 * 특정 날짜에 여러 Todo 생성
	 * @param userId - 사용자 ID
	 * @param date - 날짜 문자열 "YYYY-MM-DD"
	 * @param total - 총 Todo 수
	 * @param completed - 완료된 Todo 수
	 */
	async function createTodosForDate(
		userId: string,
		date: string,
		total: number,
		completed: number,
	): Promise<void> {
		const promises = [];
		for (let i = 0; i < total; i++) {
			promises.push(createTestTodo(userId, date, i < completed));
		}
		await Promise.all(promises);
	}

	// ===========================================================================
	// 서비스 연결 테스트
	// ===========================================================================

	describe("서비스-레포지토리 연결", () => {
		it("service가 정의되어 있어야 한다", () => {
			expect(service).toBeDefined();
		});

		it("repository가 연결되어 있어야 한다", () => {
			expect(repository).toBeDefined();
		});
	});

	// ===========================================================================
	// Repository 테스트
	// ===========================================================================

	describe("DailyCompletionRepository.aggregateTodosByDateRange", () => {
		it("날짜 범위 내 Todo를 날짜별로 집계해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(user.id, "2026-01-15", 3, 2);
			await createTodosForDate(user.id, "2026-01-16", 2, 2);

			// When
			const result = await repository.aggregateTodosByDateRange({
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
			// Given
			const user1 = await createTestUser("user1@example.com");
			const user2 = await createTestUser("user2@example.com");
			await createTodosForDate(user1.id, "2026-01-15", 3, 3);
			await createTodosForDate(user2.id, "2026-01-15", 5, 1);

			// When
			const result = await repository.aggregateTodosByDateRange({
				userId: user1.id,
				startDate: new Date("2026-01-01"),
				endDate: new Date("2026-02-01"),
			});

			// Then
			expect(result).toHaveLength(1);
			expect(result[0]?.total).toBe(3);
			expect(result[0]?.completed).toBe(3);
		});

		it("날짜 범위 외의 Todo는 포함하지 않아야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(user.id, "2025-12-31", 2, 1); // 범위 외
			await createTodosForDate(user.id, "2026-01-15", 3, 2); // 범위 내
			await createTodosForDate(user.id, "2026-02-01", 1, 1); // 범위 외

			// When
			const result = await repository.aggregateTodosByDateRange({
				userId: user.id,
				startDate: new Date("2026-01-01"),
				endDate: new Date("2026-02-01"), // exclusive
			});

			// Then
			expect(result).toHaveLength(1);
			expect(result[0]?.total).toBe(3);
		});

		it("Todo가 없으면 빈 배열을 반환해야 한다", async () => {
			// Given
			const user = await createTestUser();

			// When
			const result = await repository.aggregateTodosByDateRange({
				userId: user.id,
				startDate: new Date("2026-01-01"),
				endDate: new Date("2026-02-01"),
			});

			// Then
			expect(result).toEqual([]);
		});
	});

	describe("DailyCompletionRepository.findByDate", () => {
		it("특정 날짜의 Todo 집계를 반환해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(user.id, "2026-01-15", 5, 3);

			// When
			const result = await repository.findByDate(
				user.id,
				dayjs.utc("2026-01-15").toDate(),
			);

			// Then
			expect(result).not.toBeNull();
			expect(result?.total).toBe(5);
			expect(result?.completed).toBe(3);
		});

		it("해당 날짜에 Todo가 없으면 null을 반환해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(user.id, "2026-01-15", 3, 1);

			// When
			const result = await repository.findByDate(
				user.id,
				dayjs
					.utc("2026-01-20")
					.toDate(), // 다른 날짜
			);

			// Then
			expect(result).toBeNull();
		});
	});

	// ===========================================================================
	// Service 테스트
	// ===========================================================================

	describe("DailyCompletionService.getDailyCompletionsRange", () => {
		it("날짜 범위 내 완료 현황을 반환해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(user.id, "2026-01-15", 3, 3); // 완료
			await createTodosForDate(user.id, "2026-01-16", 2, 1); // 미완료

			// When
			const result = await service.getDailyCompletionsRange({
				userId: user.id,
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			});

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
			await createTodosForDate(user.id, "2026-01-15", 4, 3); // 75%

			// When
			const result = await service.getDailyCompletionsRange({
				userId: user.id,
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			});

			// Then
			const day15 = result.completions.find((c) => c.date === "2026-01-15");
			expect(day15?.completionRate).toBe(75);
			expect(day15?.isComplete).toBe(false);
		});

		it("모든 Todo 완료 시 isComplete가 true여야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(user.id, "2026-01-15", 5, 5);

			// When
			const result = await service.getDailyCompletionsRange({
				userId: user.id,
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			});

			// Then
			const day15 = result.completions.find((c) => c.date === "2026-01-15");
			expect(day15?.isComplete).toBe(true);
			expect(day15?.completionRate).toBe(100);
		});

		it("결과를 날짜순으로 정렬해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(user.id, "2026-01-20", 1, 1);
			await createTodosForDate(user.id, "2026-01-10", 2, 1);
			await createTodosForDate(user.id, "2026-01-15", 3, 2);

			// When
			const result = await service.getDailyCompletionsRange({
				userId: user.id,
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			});

			// Then
			expect(result.completions[0]?.date).toBe("2026-01-10");
			expect(result.completions[1]?.date).toBe("2026-01-15");
			expect(result.completions[2]?.date).toBe("2026-01-20");
		});

		it("Todo가 없으면 빈 결과를 반환해야 한다", async () => {
			// Given
			const user = await createTestUser();

			// When
			const result = await service.getDailyCompletionsRange({
				userId: user.id,
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			});

			// Then
			expect(result.completions).toEqual([]);
			expect(result.totalCompleteDays).toBe(0);
		});
	});

	// ===========================================================================
	// 경계 조건 테스트
	// ===========================================================================

	describe("경계 조건", () => {
		it("월 경계를 정확히 처리해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(user.id, "2026-01-31", 2, 2); // 1월 마지막 날
			await createTodosForDate(user.id, "2026-02-01", 3, 1); // 2월 첫 날

			// When: 1월만 조회
			const janResult = await service.getDailyCompletionsRange({
				userId: user.id,
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			});

			// Then
			expect(janResult.completions).toHaveLength(1);
			expect(janResult.completions[0]?.date).toBe("2026-01-31");

			// When: 2월만 조회
			const febResult = await service.getDailyCompletionsRange({
				userId: user.id,
				startDate: "2026-02-01",
				endDate: "2026-02-28",
			});

			// Then
			expect(febResult.completions).toHaveLength(1);
			expect(febResult.completions[0]?.date).toBe("2026-02-01");
		});

		it("하루 동안의 여러 Todo를 정확히 집계해야 한다", async () => {
			// Given
			const user = await createTestUser();

			// 같은 날짜에 10개 Todo 생성 (7개 완료)
			await createTodosForDate(user.id, "2026-01-15", 10, 7);

			// When
			const result = await service.getDailyCompletionsRange({
				userId: user.id,
				startDate: "2026-01-15",
				endDate: "2026-01-15",
			});

			// Then
			expect(result.completions).toHaveLength(1);
			expect(result.completions[0]?.totalTodos).toBe(10);
			expect(result.completions[0]?.completedTodos).toBe(7);
			expect(result.completions[0]?.completionRate).toBe(70);
		});

		it("완료된 Todo가 0개인 날도 정확히 처리해야 한다", async () => {
			// Given
			const user = await createTestUser();
			await createTodosForDate(user.id, "2026-01-15", 5, 0);

			// When
			const result = await service.getDailyCompletionsRange({
				userId: user.id,
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			});

			// Then
			const day15 = result.completions.find((c) => c.date === "2026-01-15");
			expect(day15?.totalTodos).toBe(5);
			expect(day15?.completedTodos).toBe(0);
			expect(day15?.completionRate).toBe(0);
			expect(day15?.isComplete).toBe(false);
		});
	});

	// ===========================================================================
	// 대량 데이터 테스트
	// ===========================================================================

	describe("대량 데이터 처리", () => {
		it("한 달 전체 데이터를 효율적으로 처리해야 한다", async () => {
			// Given: 한 달 동안 매일 3개씩 Todo 생성
			const user = await createTestUser();
			const promises = [];
			for (let day = 1; day <= 31; day++) {
				const dateStr = `2026-01-${String(day).padStart(2, "0")}`;
				promises.push(createTodosForDate(user.id, dateStr, 3, day % 4)); // 0~3개 완료
			}
			await Promise.all(promises);

			// When
			const startTime = Date.now();
			const result = await service.getDailyCompletionsRange({
				userId: user.id,
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			});
			const duration = Date.now() - startTime;

			// Then
			expect(result.completions).toHaveLength(31);
			expect(duration).toBeLessThan(5000); // 5초 이내
		});
	});
});
