/**
 * TodoService 통합 테스트
 *
 * @description
 * TodoService가 TodoRepository, PaginationService와 함께 올바르게 작동하는지 검증합니다.
 * 실제 데이터베이스 대신 모킹된 Repository를 사용하여 서비스 계층 통합을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - TodoService와 TodoRepository의 통합 검증
 * - PaginationService와의 통합 검증
 * - BusinessException 에러 처리가 올바르게 작동하는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test todo.integration-spec
 * ```
 */

import {
	type DayOfWeek,
	TODO_ITEM_LIMITS,
	TODO_LIMITS,
} from "@aido/validators";
import { Test, type TestingModule } from "@nestjs/testing";
import { TodoBuilder, TodoCategoryBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { CacheService } from "@/common/cache/cache.service";
import { TypedConfigService } from "@/common/config/services/config.service";
import {
	BusinessException,
	BusinessExceptions,
} from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import type { TodoCategory } from "@/generated/prisma/client";
import { FollowService } from "@/modules/follow/follow.service";
import { NotificationQueueService } from "@/modules/notification/queue/notification-queue.service";
import { REMINDER_SCHEDULER } from "@/modules/scheduler/reminder";
import { TodoRepository } from "@/modules/todo/todo.repository";
import { TodoService } from "@/modules/todo/todo.service";
import { TodoCategoryRepository } from "@/modules/todo-category/todo-category.repository";
import { TodoCategoryService } from "@/modules/todo-category/todo-category.service";
import { StreakService } from "@/modules/user-settings/services/streak.service";

describe("TodoService 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let service: TodoService;
	let repository: TodoRepository;

	// Mock 데이터베이스 서비스
	const mockTodoDb = {
		create: jest.fn(),
		createMany: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		updateMany: jest.fn(),
		count: jest.fn().mockResolvedValue(0),
		aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 0 } }),
	};

	const mockTodoCategoryDb = {
		findFirst: jest.fn(),
	};

	const mockTodoItemDb = {
		create: jest.fn(),
		createMany: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		count: jest.fn().mockResolvedValue(0),
		aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: -1 } }),
	};

	const mockDatabaseService = createMockDatabaseService({
		todo: mockTodoDb,
		todoCategory: mockTodoCategoryDb,
		todoItem: mockTodoItemDb,
	});

	// Mock FollowService
	const mockFollowService = {
		isMutualFriend: jest.fn(),
	};

	// Mock TodoCategoryRepository
	const mockTodoCategoryRepository = {
		findByIdAndUserId: jest.fn(),
	};

	// Mock TodoCategoryService
	const mockTodoCategoryService = {
		validateOwnership: jest.fn(),
	};

	// Mock TodoReminderSchedulerService
	const mockReminderScheduler = {
		scheduleReminder: jest.fn(),
		cancelReminder: jest.fn(),
	};

	// 테스트 데이터
	const mockUserId = "user-integration-123";
	const mockFriendUserId = "friend-user-456";
	const mockTodoId = 1;
	const mockCategoryId = 1;

	const mockCategory: TodoCategory = TodoCategoryBuilder.create(mockUserId)
		.withId(mockCategoryId)
		.withName("중요한 일")
		.withColor("#FFB3B3")
		.build();

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				TodoService,
				TodoRepository,
				PaginationService,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
				{
					provide: FollowService,
					useValue: mockFollowService,
				},
				{
					provide: CacheService,
					useValue: {
						invalidateTodoCategories: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: TypedConfigService,
					useValue: {
						pagination: {
							defaultPageSize: 20,
							maxPageSize: 100,
						},
					},
				},
				{
					provide: TodoCategoryRepository,
					useValue: mockTodoCategoryRepository,
				},
				{
					provide: TodoCategoryService,
					useValue: mockTodoCategoryService,
				},
				{
					provide: REMINDER_SCHEDULER,
					useValue: mockReminderScheduler,
				},
				{
					provide: StreakService,
					useValue: {
						onTodoToggled: jest.fn().mockResolvedValue(undefined),
						recordCompletion: jest.fn().mockResolvedValue(undefined),
						removeCompletion: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: NotificationQueueService,
					useValue: {
						enqueueTodoAllCompleted: jest.fn(),
						enqueueFriendCompleted: jest.fn(),
						enqueueFollowNew: jest.fn(),
						enqueueFollowMutual: jest.fn(),
						enqueueNudgeSent: jest.fn(),
						enqueueCheerSent: jest.fn(),
						enqueueBillingIssue: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<TodoService>(TodoService);
		repository = module.get<TodoRepository>(TodoRepository);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		TodoBuilder.resetIdCounter();
		TodoCategoryBuilder.resetIdCounter();
	});

	describe("DI 통합", () => {
		it("TodoService가 올바르게 인스턴스화된다", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 서비스 인스턴스 확인

			// Then - 서비스가 정의되어 있어야 함
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(TodoService);
		});

		it("TodoRepository가 올바르게 주입된다", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 레포지토리 인스턴스 확인

			// Then - 레포지토리가 정의되어 있어야 함
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(TodoRepository);
		});
	});

	describe("create 통합 테스트", () => {
		it("Todo 생성이 Repository를 통해 올바르게 수행된다", async () => {
			// Given - 사용자와 카테고리 준비
			const mockTodoWithCategory = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withTitle("통합 테스트 할 일")
				.withCategoryId(mockCategoryId)
				.withCategory({
					id: mockCategoryId,
					name: mockCategory.name,
					color: mockCategory.color,
					sortOrder: 0,
				})
				.build();
			mockDatabaseService.todo.create.mockResolvedValue(mockTodoWithCategory);
			mockTodoCategoryRepository.findByIdAndUserId.mockResolvedValue(
				mockCategory,
			);

			const createInput = {
				userId: mockUserId,
				title: "새로운 할 일",
				categoryId: mockCategoryId,
				startDate: new Date("2024-01-15"),
			};

			// When - 서비스 메서드 호출
			const result = await service.create(createInput);

			// Then - 결과 검증
			expect(result.id).toEqual(mockTodoWithCategory.id);
			expect(result.title).toEqual(mockTodoWithCategory.title);
			expect(result.category).toBeDefined();
			expect(mockDatabaseService.todo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						user: { connect: { id: mockUserId } },
						title: createInput.title,
						category: { connect: { id: mockCategoryId } },
					}),
				}),
			);
		});

		it("기본값이 올바르게 적용된다", async () => {
			// Given - 최소 입력값만 준비
			const mockTodoWithCategory = TodoBuilder.create(mockUserId)
				.withIsAllDay(true)
				.withVisibility("PUBLIC")
				.withCategoryId(mockCategoryId)
				.build();
			mockDatabaseService.todo.create.mockResolvedValue(mockTodoWithCategory);
			mockTodoCategoryRepository.findByIdAndUserId.mockResolvedValue(
				mockCategory,
			);

			const minimalInput = {
				userId: mockUserId,
				title: "최소 할 일",
				categoryId: mockCategoryId,
				startDate: new Date("2024-01-15"),
			};

			// When - 최소 입력으로 생성
			await service.create(minimalInput);

			// Then - 기본값이 적용됨
			expect(mockDatabaseService.todo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						isAllDay: true,
						visibility: "PUBLIC",
						category: { connect: { id: mockCategoryId } },
					}),
				}),
			);
		});

		it("존재하지 않는 카테고리로 생성 시 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 카테고리
			mockTodoCategoryService.validateOwnership.mockRejectedValue(
				BusinessExceptions.todoCategoryNotFound(999),
			);

			const createInput = {
				userId: mockUserId,
				title: "새로운 할 일",
				categoryId: 999,
				startDate: new Date("2024-01-15"),
			};

			// When & Then - 예외 발생 검증
			await expect(service.create(createInput)).rejects.toThrow(
				BusinessException,
			);

			// cleanup
			mockTodoCategoryService.validateOwnership.mockResolvedValue(undefined);
		});
	});

	describe("findById 통합 테스트", () => {
		it("존재하는 Todo를 조회한다", async () => {
			// Given - 조회할 Todo 준비
			const mockTodoWithCategory = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withTitle("통합 테스트 할 일")
				.withCategory({
					id: mockCategory.id,
					name: mockCategory.name,
					color: mockCategory.color,
					sortOrder: 0,
				})
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(
				mockTodoWithCategory,
			);

			// When - 서비스 메서드 호출
			const result = await service.findById(mockTodoId, mockUserId);

			// Then - 결과 검증
			expect(result.id).toEqual(mockTodoWithCategory.id);
			expect(result.title).toEqual(mockTodoWithCategory.title);
			expect(result.userId).toEqual(mockTodoWithCategory.userId);
			expect(result.category).toBeDefined();
			expect(result.category.id).toEqual(mockCategory.id);
			expect(result.category.name).toEqual(mockCategory.name);
			expect(result.category.color).toEqual(mockCategory.color);
		});

		it("존재하지 않는 Todo 조회 시 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(service.findById(999, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 Todo 조회 시 BusinessException을 던진다", async () => {
			// Given - 다른 사용자의 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(service.findById(mockTodoId, "other-user")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	describe("findMany 통합 테스트", () => {
		it("Todo 목록을 페이지네이션하여 반환한다", async () => {
			// Given - Todo 목록 준비
			const mockTodos = [
				TodoBuilder.create(mockUserId).withId(1).build(),
				TodoBuilder.create(mockUserId).withId(2).build(),
				TodoBuilder.create(mockUserId).withId(3).build(),
			];
			mockDatabaseService.todo.findMany.mockResolvedValue(mockTodos);

			// When - 서비스 메서드 호출
			const result = await service.findMany({ userId: mockUserId });

			// Then - 결과 검증
			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(result.pagination.hasNext).toBeDefined();
		});

		it("완료 상태 필터가 올바르게 적용된다", async () => {
			// Given - 완료된 Todo 목록
			const completedTodos = [
				TodoBuilder.create(mockUserId).withId(1).completed().build(),
			];
			mockDatabaseService.todo.findMany.mockResolvedValue(completedTodos);

			// When - 완료 상태로 필터링
			await service.findMany({
				userId: mockUserId,
				completed: true,
			});

			// Then - 쿼리에 완료 조건 포함
			expect(mockDatabaseService.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						completed: true,
					}),
				}),
			);
		});

		it("날짜 범위 필터가 올바르게 적용된다", async () => {
			// Given - 날짜 범위 설정
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");
			mockDatabaseService.todo.findMany.mockResolvedValue([]);

			// When - 날짜 범위로 필터링
			await service.findMany({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - 쿼리에 날짜 범위 조건 포함
			const calledArgs = mockDatabaseService.todo.findMany.mock.calls[0]?.[0];
			expect(calledArgs.where.AND).toBeDefined();
			expect(calledArgs.where.userId).toBe(mockUserId);
		});

		it("커서 기반 페이지네이션이 올바르게 작동한다", async () => {
			// Given - 페이지네이션 설정
			mockDatabaseService.todo.findMany.mockResolvedValue([]);

			// When - 커서와 사이즈 지정
			await service.findMany({
				userId: mockUserId,
				cursor: 10,
				size: 10,
			});

			// Then - 쿼리에 커서 조건 포함
			expect(mockDatabaseService.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 1,
					cursor: { id: 10 },
				}),
			);
		});
	});

	describe("에러 핸들링 통합 테스트", () => {
		it("Repository 에러가 적절하게 전파된다", async () => {
			// Given - DB 연결 실패 시뮬레이션
			mockTodoCategoryRepository.findByIdAndUserId.mockResolvedValue(
				mockCategory,
			);
			mockDatabaseService.todo.create.mockRejectedValue(
				new Error("Database connection failed"),
			);

			// When & Then - 에러 전파 검증
			await expect(
				service.create({
					userId: mockUserId,
					title: "테스트",
					categoryId: mockCategoryId,
					startDate: new Date(),
				}),
			).rejects.toThrow("Database connection failed");
		});

		it("BusinessException이 적절하게 던져진다", async () => {
			// Given - 존재하지 않는 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then - BusinessException 검증
			try {
				await service.findById(999, mockUserId);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessException);
				expect((error as BusinessException).errorCode).toContain("TODO");
			}
		});
	});

	describe("toggleComplete 통합 테스트", () => {
		it("미완료 Todo를 완료로 변경하면 completedAt이 설정된다", async () => {
			// Given - 미완료 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.uncompleted()
				.build();
			const completedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.completed()
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(completedTodo);

			// When - 완료 상태로 토글
			const result = await service.toggleComplete(mockTodoId, mockUserId, {
				completed: true,
			});

			// Then - 완료 상태 검증
			expect(result.completed).toBe(true);
			expect(result.completedAt).not.toBeNull();
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: expect.objectContaining({
						completed: true,
						completedAt: expect.any(Date),
					}),
				}),
			);
		});

		it("완료된 Todo를 미완료로 변경하면 completedAt이 null이 된다", async () => {
			// Given - 완료된 Todo 준비
			const completedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.completed(new Date("2024-01-10"))
				.build();
			const uncompletedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.uncompleted()
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(completedTodo);
			mockDatabaseService.todo.update.mockResolvedValue(uncompletedTodo);

			// When - 미완료 상태로 토글
			const result = await service.toggleComplete(mockTodoId, mockUserId, {
				completed: false,
			});

			// Then - 미완료 상태 검증
			expect(result.completed).toBe(false);
			expect(result.completedAt).toBeNull();
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: {
						completed: false,
						completedAt: null,
					},
				}),
			);
		});

		it("존재하지 않는 Todo에 대해 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.toggleComplete(999, mockUserId, { completed: true }),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("createRecurring 통합 테스트", () => {
		it("NestJS DI 환경에서 createRecurring이 올바르게 동작한다", async () => {
			// Given - 반복 할 일 데이터 준비
			mockTodoDb.aggregate.mockResolvedValue({ _max: { sortOrder: 5 } });
			mockTodoDb.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) =>
					Promise.resolve(
						TodoBuilder.create(mockUserId)
							.withTitle(data.title as string)
							.withRecurrenceGroupId("test-group-id")
							.build(),
					),
			);
			mockTodoDb.count.mockResolvedValue(0); // 카테고리당 활성 투두 0개
			mockTodoCategoryService.validateOwnership.mockResolvedValue(undefined);

			const recurringData = {
				userId: mockUserId,
				title: "반복 할 일",
				categoryId: mockCategoryId,
				startDate: "2026-03-02",
				endDate: "2026-03-08",
				daysOfWeek: ["MON", "WED", "FRI"] as DayOfWeek[],
			};

			// When - createRecurring 호출
			const result = await service.createRecurring(recurringData);

			// Then - 올바른 결과 반환
			expect(result.todos).toBeDefined();
			expect(result.count).toBeGreaterThan(0);
			expect(mockTodoCategoryService.validateOwnership).toHaveBeenCalledWith(
				mockCategoryId,
				mockUserId,
			);
			expect(mockDatabaseService.$transaction).toHaveBeenCalled();
		});

		it("카테고리당 리소스 제한 초과 시 BusinessException을 던진다", async () => {
			// Given - 카테고리의 활성 Todo가 한도에 가까운 상태 (298 + 3 > 300)
			mockTodoDb.count.mockResolvedValue(TODO_LIMITS.MAX_PER_CATEGORY - 2);
			mockTodoCategoryService.validateOwnership.mockResolvedValue(undefined);

			const recurringData = {
				userId: mockUserId,
				title: "반복 할 일",
				categoryId: mockCategoryId,
				startDate: "2026-03-02",
				endDate: "2026-03-08",
				daysOfWeek: ["MON", "WED", "FRI"] as DayOfWeek[],
			};

			// When & Then - 3개 생성 시도 시 298 + 3 > 300 → 예외
			await expect(service.createRecurring(recurringData)).rejects.toThrow(
				BusinessException,
			);
		});

		it("매칭 날짜가 0개이면 BusinessException을 던진다", async () => {
			// Given - 매칭되지 않는 요일 (2026-03-03은 화요일)
			const recurringData = {
				userId: mockUserId,
				title: "반복 할 일",
				categoryId: mockCategoryId,
				startDate: "2026-03-03",
				endDate: "2026-03-03",
				daysOfWeek: ["FRI"] as DayOfWeek[],
			};

			// When & Then - 해당 날짜에 금요일이 없으므로 예외
			await expect(service.createRecurring(recurringData)).rejects.toThrow(
				BusinessException,
			);
		});
	});

	describe("동시성 시나리오 테스트", () => {
		it("여러 Todo를 동시에 생성할 수 있다", async () => {
			// Given - 동시 생성 준비
			let createCount = 0;
			mockTodoCategoryRepository.findByIdAndUserId.mockResolvedValue(
				mockCategory,
			);
			mockDatabaseService.todo.create.mockImplementation(() => {
				createCount++;
				return Promise.resolve(
					TodoBuilder.create(mockUserId).withId(createCount).build(),
				);
			});

			// When - 동시에 여러 Todo 생성
			const promises = [
				service.create({
					userId: mockUserId,
					title: "할 일 1",
					categoryId: mockCategoryId,
					startDate: new Date(),
				}),
				service.create({
					userId: mockUserId,
					title: "할 일 2",
					categoryId: mockCategoryId,
					startDate: new Date(),
				}),
				service.create({
					userId: mockUserId,
					title: "할 일 3",
					categoryId: mockCategoryId,
					startDate: new Date(),
				}),
			];

			const results = await Promise.all(promises);

			// Then - 모든 생성 완료 검증
			expect(results).toHaveLength(3);
			expect(mockDatabaseService.todo.create).toHaveBeenCalledTimes(3);
		});
	});

	describe("findFriendTodos 통합 테스트", () => {
		it("맞팔 관계인 친구의 PUBLIC 투두를 조회한다", async () => {
			// Given - 맞팔 친구의 공개 Todo 준비
			const friendTodos = [
				TodoBuilder.create(mockFriendUserId).withId(1).asPublic().build(),
				TodoBuilder.create(mockFriendUserId).withId(2).asPublic().build(),
			];
			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockDatabaseService.todo.findMany.mockResolvedValue(friendTodos);

			// When - 친구 Todo 조회
			const result = await service.findFriendTodos({
				userId: mockUserId,
				friendUserId: mockFriendUserId,
			});

			// Then - 공개 Todo만 조회됨
			expect(result.items).toHaveLength(2);
			expect(result.pagination).toBeDefined();
			expect(mockFollowService.isMutualFriend).toHaveBeenCalledWith(
				mockUserId,
				mockFriendUserId,
			);
			expect(mockDatabaseService.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: mockFriendUserId,
						visibility: "PUBLIC",
					}),
				}),
			);
		});

		it("맞팔이 아닌 경우 BusinessException을 던진다", async () => {
			// Given - 맞팔이 아닌 관계
			mockFollowService.isMutualFriend.mockResolvedValue(false);

			// When & Then - 예외 발생 검증
			await expect(
				service.findFriendTodos({
					userId: mockUserId,
					friendUserId: mockFriendUserId,
				}),
			).rejects.toThrow(BusinessException);

			expect(mockFollowService.isMutualFriend).toHaveBeenCalledWith(
				mockUserId,
				mockFriendUserId,
			);
			// 맞팔이 아니면 Repository 호출하지 않음
			expect(mockDatabaseService.todo.findMany).not.toHaveBeenCalled();
		});

		it("날짜 범위 필터가 올바르게 적용된다", async () => {
			// Given - 날짜 범위 설정
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");
			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockDatabaseService.todo.findMany.mockResolvedValue([]);

			// When - 날짜 범위로 필터링
			await service.findFriendTodos({
				userId: mockUserId,
				friendUserId: mockFriendUserId,
				startDate,
				endDate,
			});

			// Then - 쿼리에 날짜 범위 조건 포함
			const calledArgs = mockDatabaseService.todo.findMany.mock.calls[0]?.[0];
			expect(calledArgs.where.AND).toBeDefined();
			expect(calledArgs.where.userId).toBe(mockFriendUserId);
			expect(calledArgs.where.visibility).toBe("PUBLIC");
		});

		it("커서 기반 페이지네이션이 올바르게 작동한다", async () => {
			// Given - 페이지네이션 설정
			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockDatabaseService.todo.findMany.mockResolvedValue([]);

			// When - 커서와 사이즈 지정
			await service.findFriendTodos({
				userId: mockUserId,
				friendUserId: mockFriendUserId,
				cursor: 10,
				size: 10,
			});

			// Then - 쿼리에 커서 조건 포함
			expect(mockDatabaseService.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 1,
					cursor: { id: 10 },
				}),
			);
		});

		it("다음 페이지가 있는지 올바르게 판단한다", async () => {
			// Given - 다음 페이지 존재 여부 확인용 Todo 목록
			const todos = [
				TodoBuilder.create(mockFriendUserId).withId(1).build(),
				TodoBuilder.create(mockFriendUserId).withId(2).build(),
				TodoBuilder.create(mockFriendUserId).withId(3).build(),
			];
			mockFollowService.isMutualFriend.mockResolvedValue(true);
			// size + 1개를 반환해서 다음 페이지가 있음을 나타냄
			mockDatabaseService.todo.findMany.mockResolvedValue(todos);

			// When - 페이지 크기 2로 조회
			const result = await service.findFriendTodos({
				userId: mockUserId,
				friendUserId: mockFriendUserId,
				size: 2,
			});

			// Then - 다음 페이지 존재 검증
			expect(result.pagination.hasNext).toBe(true);
			expect(result.items).toHaveLength(2);
		});
	});

	describe("하위 항목 통합 테스트", () => {
		const now = new Date();

		const createMockItem = (id: number, title: string, sortOrder = 0) => ({
			id,
			title,
			completed: false,
			sortOrder,
			createdAt: now,
			updatedAt: now,
		});

		it("addItem: 제한 체크 + 생성 + 반환 플로우", async () => {
			// Given - Todo와 하위 항목 준비
			const todoWithNoItems = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withItems([])
				.build();
			const newItem = createMockItem(1, "새 항목", 0);
			const todoWithItem = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withItems([newItem])
				.build();

			// 1차 findFirst: 소유권 확인 (TX 외부)
			// 2차 findFirst: TX 내부 countItemsByTodoId 후 createItem 후 재조회
			mockDatabaseService.todo.findFirst
				.mockResolvedValueOnce(todoWithNoItems)
				.mockResolvedValueOnce(todoWithItem);
			mockTodoItemDb.count.mockResolvedValue(0);
			mockTodoItemDb.aggregate.mockResolvedValue({ _max: { sortOrder: -1 } });
			mockTodoItemDb.create.mockResolvedValue(newItem);

			// When - 하위 항목 추가
			const result = await service.addItem(mockTodoId, mockUserId, {
				title: "새 항목",
			});

			// Then - 결과에 items와 itemStats가 포함됨
			expect(result.items).toBeDefined();
			expect(result.itemStats).toBeDefined();
			expect(mockTodoItemDb.count).toHaveBeenCalled();
			expect(mockTodoItemDb.create).toHaveBeenCalled();
		});

		it("addItem: 한도 초과 시 BusinessException", async () => {
			// Given - 이미 한도에 도달한 Todo
			const todoWithItems = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withItems([])
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(todoWithItems);
			mockTodoItemDb.count.mockResolvedValue(TODO_ITEM_LIMITS.MAX_PER_TODO);

			// When & Then - 한도 초과 예외 발생
			await expect(
				service.addItem(mockTodoId, mockUserId, { title: "초과 항목" }),
			).rejects.toThrow(BusinessException);
		});

		it("updateItem: 소유권 확인 + 수정 + 반환 플로우", async () => {
			// Given - 하위 항목이 포함된 Todo 준비
			const item = createMockItem(10, "기존 항목", 0);
			const todoWithItem = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withItems([item])
				.build();
			const updatedItem = { ...item, completed: true };
			const todoAfterUpdate = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withItems([updatedItem])
				.build();

			// 1차: 소유권 확인 + 항목 존재 검증, 2차: 수정 후 재조회
			mockDatabaseService.todo.findFirst
				.mockResolvedValueOnce(todoWithItem)
				.mockResolvedValueOnce(todoAfterUpdate);
			mockTodoItemDb.update.mockResolvedValue(updatedItem);

			// When - 하위 항목 수정
			const result = await service.updateItem(mockTodoId, 10, mockUserId, {
				completed: true,
			});

			// Then - update가 호출됨
			expect(result).toBeDefined();
			expect(mockTodoItemDb.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 10 },
					data: { completed: true },
				}),
			);
		});

		it("deleteItem: 소유권 확인 + 삭제 + 반환 플로우", async () => {
			// Given - 하위 항목이 포함된 Todo 준비
			const item = createMockItem(10, "삭제할 항목", 0);
			const todoWithItem = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withItems([item])
				.build();
			const todoAfterDelete = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withItems([])
				.build();

			// 1차: 소유권 확인 + 항목 존재 검증, 2차: 삭제 후 재조회
			mockDatabaseService.todo.findFirst
				.mockResolvedValueOnce(todoWithItem)
				.mockResolvedValueOnce(todoAfterDelete);
			mockTodoItemDb.delete.mockResolvedValue(item);

			// When - 하위 항목 삭제
			const result = await service.deleteItem(mockTodoId, 10, mockUserId);

			// Then - delete가 호출됨
			expect(result).toBeDefined();
			expect(mockTodoItemDb.delete).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 10 },
				}),
			);
		});

		it("reorderItems: 전체 ID 검증 + 순서 변경 플로우", async () => {
			// Given - 3개의 하위 항목이 포함된 Todo 준비
			const items = [
				createMockItem(1, "항목 1", 0),
				createMockItem(2, "항목 2", 1),
				createMockItem(3, "항목 3", 2),
			];
			const todoWithItems = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withItems(items)
				.build();
			const reorderedItems = [
				createMockItem(3, "항목 3", 0),
				createMockItem(1, "항목 1", 1),
				createMockItem(2, "항목 2", 2),
			];
			const todoAfterReorder = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withItems(reorderedItems)
				.build();

			// 1차: TX 내 소유권 확인 + 검증, 2차: reorder 후 재조회
			mockDatabaseService.todo.findFirst
				.mockResolvedValueOnce(todoWithItems)
				.mockResolvedValueOnce(todoAfterReorder);
			mockTodoItemDb.update.mockResolvedValue({});

			// When - 하위 항목 순서 변경
			const result = await service.reorderItems(mockTodoId, mockUserId, {
				itemIds: [3, 1, 2],
			});

			// Then - update가 3번 호출됨 (각 항목마다 sortOrder 업데이트)
			expect(result).toBeDefined();
			expect(mockTodoItemDb.update).toHaveBeenCalledTimes(3);
		});
	});
});
