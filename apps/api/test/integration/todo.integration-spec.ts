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

import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { TodoBuilder, TodoCategoryBuilder } from "@test/builders";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import type { TodoCategory } from "@/generated/prisma/client";
import { FollowService } from "@/modules/follow/follow.service";
import { TodoRepository } from "@/modules/todo/todo.repository";
import { TodoService } from "@/modules/todo/todo.service";
import { TodoCategoryRepository } from "@/modules/todo-category/todo-category.repository";

describe("TodoService Integration Tests", () => {
	let module: TestingModule;
	let service: TodoService;
	let repository: TodoRepository;

	// Mock 데이터베이스 서비스
	const mockTodoDb = {
		create: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		updateMany: jest.fn(),
		aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 0 } }),
	};

	const mockTodoCategoryDb = {
		findFirst: jest.fn(),
	};

	const mockDatabaseService: {
		todo: typeof mockTodoDb;
		todoCategory: typeof mockTodoCategoryDb;
		$transaction: jest.Mock;
	} = {
		todo: mockTodoDb,
		todoCategory: mockTodoCategoryDb,
		$transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
			cb(mockDatabaseService),
		),
	};

	// Mock FollowService
	const mockFollowService = {
		isMutualFriend: jest.fn(),
	};

	// Mock EventEmitter
	const mockEventEmitter = {
		emit: jest.fn(),
	};

	// Mock TodoCategoryRepository
	const mockTodoCategoryRepository = {
		findByIdAndUserId: jest.fn(),
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
		// Logger 출력 비활성화
		jest.spyOn(Logger.prototype, "log").mockImplementation();
		jest.spyOn(Logger.prototype, "warn").mockImplementation();
		jest.spyOn(Logger.prototype, "error").mockImplementation();
		jest.spyOn(Logger.prototype, "debug").mockImplementation();
	});

	beforeEach(async () => {
		jest.clearAllMocks();
		TodoBuilder.resetIdCounter();
		TodoCategoryBuilder.resetIdCounter();

		// NestJS 테스트 모듈 생성 - 실제 DI 컨테이너 사용
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
					provide: EventEmitter2,
					useValue: mockEventEmitter,
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
			],
		}).compile();

		service = module.get<TodoService>(TodoService);
		repository = module.get<TodoRepository>(TodoRepository);
	});

	afterEach(async () => {
		if (module) {
			await module.close();
		}
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
				.withContent("통합 테스트 내용")
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
				content: "할 일 내용",
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
						content: createInput.content,
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
			mockTodoCategoryRepository.findByIdAndUserId.mockResolvedValue(null);

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
			expect(mockDatabaseService.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							{ startDate: { lte: endDate } },
							{
								OR: [
									{ endDate: { gte: startDate } },
									{ endDate: null, startDate: { gte: startDate } },
								],
							},
						]),
					}),
				}),
			);
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

	describe("update 통합 테스트", () => {
		it("Todo를 수정하고 반환한다", async () => {
			// Given - 수정할 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.build();
			const updatedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withTitle("수정된 제목")
				.build();

			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When - 서비스 메서드 호출
			const result = await service.update(mockTodoId, mockUserId, {
				title: "수정된 제목",
			});

			// Then - 결과 검증
			expect(result.title).toBe("수정된 제목");
		});

		it("완료 상태 변경 시 completedAt이 자동 설정된다", async () => {
			// Given - 미완료 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.uncompleted()
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(
				TodoBuilder.create(mockUserId).withId(mockTodoId).completed().build(),
			);

			// When - 완료 상태로 변경
			await service.update(mockTodoId, mockUserId, { completed: true });

			// Then - completedAt이 설정됨
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

		it("미완료로 변경 시 completedAt이 null로 설정된다", async () => {
			// Given - 완료된 Todo 준비
			const completedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.completed()
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(completedTodo);
			mockDatabaseService.todo.update.mockResolvedValue(
				TodoBuilder.create(mockUserId).withId(mockTodoId).uncompleted().build(),
			);

			// When - 미완료 상태로 변경
			await service.update(mockTodoId, mockUserId, { completed: false });

			// Then - completedAt이 null로 설정됨
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: expect.objectContaining({
						completed: false,
						completedAt: null,
					}),
				}),
			);
		});

		it("존재하지 않는 Todo 수정 시 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.update(999, mockUserId, { title: "수정" }),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("delete 통합 테스트", () => {
		it("Todo를 삭제한다", async () => {
			// Given - 삭제할 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.delete.mockResolvedValue(mockTodo);

			// When - 서비스 메서드 호출
			await service.delete(mockTodoId, mockUserId);

			// Then - 삭제 메서드 호출 검증
			expect(mockDatabaseService.todo.delete).toHaveBeenCalledWith({
				where: { id: mockTodoId },
			});
		});

		it("존재하지 않는 Todo 삭제 시 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(service.delete(999, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 Todo 삭제 시 BusinessException을 던진다", async () => {
			// Given - 다른 사용자의 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(service.delete(mockTodoId, "other-user")).rejects.toThrow(
				BusinessException,
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

	// ============================================
	// SRP 메서드 통합 테스트
	// ============================================

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

	describe("updateVisibility 통합 테스트", () => {
		it("PUBLIC에서 PRIVATE로 변경한다", async () => {
			// Given - PUBLIC Todo 준비
			const publicTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.asPublic()
				.build();
			const privateTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.asPrivate()
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(publicTodo);
			mockDatabaseService.todo.update.mockResolvedValue(privateTodo);

			const input: { visibility: "PUBLIC" | "PRIVATE" } = {
				visibility: "PRIVATE",
			};

			// When - 비공개로 변경
			const result = await service.updateVisibility(
				mockTodoId,
				mockUserId,
				input,
			);

			// Then - 비공개 상태 검증
			expect(result.visibility).toBe("PRIVATE");
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: { visibility: "PRIVATE" },
				}),
			);
		});

		it("PRIVATE에서 PUBLIC으로 변경한다", async () => {
			// Given - PRIVATE Todo 준비
			const privateTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.asPrivate()
				.build();
			const publicTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.asPublic()
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(privateTodo);
			mockDatabaseService.todo.update.mockResolvedValue(publicTodo);

			const input: { visibility: "PUBLIC" | "PRIVATE" } = {
				visibility: "PUBLIC",
			};

			// When - 공개로 변경
			const result = await service.updateVisibility(
				mockTodoId,
				mockUserId,
				input,
			);

			// Then - 공개 상태 검증
			expect(result.visibility).toBe("PUBLIC");
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: { visibility: "PUBLIC" },
				}),
			);
		});

		it("존재하지 않는 Todo에 대해 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			const input: { visibility: "PUBLIC" | "PRIVATE" } = {
				visibility: "PRIVATE",
			};

			// When & Then - 예외 발생 검증
			await expect(
				service.updateVisibility(999, mockUserId, input),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("updateCategory 통합 테스트", () => {
		it("카테고리를 변경한다", async () => {
			// Given - 카테고리 변경 대상 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withCategoryId(1)
				.build();
			const newCategory = TodoCategoryBuilder.create(mockUserId)
				.withId(2)
				.withName("할 일")
				.withColor("#FF6B43")
				.build();
			const updatedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withCategoryId(2)
				.withCategory({
					id: 2,
					name: "할 일",
					color: "#FF6B43",
					sortOrder: 1,
				})
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockTodoCategoryRepository.findByIdAndUserId.mockResolvedValue(
				newCategory,
			);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When - 카테고리 변경
			const result = await service.updateCategory(mockTodoId, mockUserId, {
				categoryId: 2,
			});

			// Then - 변경된 카테고리 검증
			expect(result.category.id).toBe(2);
			expect(result.category.name).toBe("할 일");
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: { category: { connect: { id: 2 } } },
				}),
			);
		});

		it("존재하지 않는 카테고리로 변경 시 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 카테고리
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockTodoCategoryRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.updateCategory(mockTodoId, mockUserId, { categoryId: 999 }),
			).rejects.toThrow(BusinessException);
		});

		it("존재하지 않는 Todo에 대해 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.updateCategory(999, mockUserId, { categoryId: 1 }),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("updateSchedule 통합 테스트", () => {
		it("일정을 변경한다", async () => {
			// Given - 일정 변경 대상 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.build();
			const updatedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withStartDate(new Date("2024-02-01"))
				.withEndDate(new Date("2024-02-05"))
				.withScheduledTime(new Date("2024-02-01T14:30:00"))
				.withIsAllDay(false)
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			const input = {
				startDate: "2024-02-01",
				endDate: "2024-02-05",
				scheduledTime: "14:30",
				isAllDay: false,
			};

			// When - 일정 변경
			const result = await service.updateSchedule(
				mockTodoId,
				mockUserId,
				input,
			);

			// Then - 변경된 일정 검증
			expect(result.isAllDay).toBe(false);
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: expect.objectContaining({
						startDate: expect.any(Date),
						endDate: expect.any(Date),
						scheduledTime: expect.any(Date),
						isAllDay: false,
					}),
				}),
			);
		});

		it("endDate와 scheduledTime을 null로 설정할 수 있다", async () => {
			// Given - 일정 초기화 대상 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.build();
			const updatedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withStartDate(new Date("2024-02-01"))
				.withEndDate(null)
				.withScheduledTime(null)
				.withIsAllDay(true)
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			const input = {
				startDate: "2024-02-01",
				endDate: null,
				scheduledTime: null,
				isAllDay: true,
			};

			// When - 일정 초기화
			await service.updateSchedule(mockTodoId, mockUserId, input);

			// Then - null 값 설정 검증
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: expect.objectContaining({
						startDate: expect.any(Date),
						endDate: null,
						scheduledTime: null,
						isAllDay: true,
					}),
				}),
			);
		});

		it("isAllDay를 생략하면 기본값 true를 사용한다", async () => {
			// Given - 일정 변경 대상 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(mockTodo);

			const input = {
				startDate: "2024-02-01",
			};

			// When - isAllDay 생략
			await service.updateSchedule(mockTodoId, mockUserId, input);

			// Then - 기본값 true 적용 검증
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: expect.objectContaining({
						isAllDay: true,
					}),
				}),
			);
		});

		it("존재하지 않는 Todo에 대해 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.updateSchedule(999, mockUserId, { startDate: "2024-02-01" }),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("updateContent 통합 테스트", () => {
		it("제목만 변경한다", async () => {
			// Given - 제목 변경 대상 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withTitle("기존 제목")
				.build();
			const updatedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withTitle("새로운 제목")
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When - 제목 변경
			const result = await service.updateContent(mockTodoId, mockUserId, {
				title: "새로운 제목",
			});

			// Then - 제목 변경 검증
			expect(result.title).toBe("새로운 제목");
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: { title: "새로운 제목" },
				}),
			);
		});

		it("내용만 변경한다", async () => {
			// Given - 내용 변경 대상 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withContent("기존 내용")
				.build();
			const updatedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withContent("새로운 내용")
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When - 내용 변경
			const result = await service.updateContent(mockTodoId, mockUserId, {
				content: "새로운 내용",
			});

			// Then - 내용 변경 검증
			expect(result.content).toBe("새로운 내용");
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: { content: "새로운 내용" },
				}),
			);
		});

		it("제목과 내용을 동시에 변경한다", async () => {
			// Given - 제목/내용 변경 대상 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.build();
			const updatedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withTitle("새 제목")
				.withContent("새 내용")
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When - 제목/내용 동시 변경
			await service.updateContent(mockTodoId, mockUserId, {
				title: "새 제목",
				content: "새 내용",
			});

			// Then - 동시 변경 검증
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: {
						title: "새 제목",
						content: "새 내용",
					},
				}),
			);
		});

		it("내용을 null로 설정하여 삭제한다", async () => {
			// Given - 내용 삭제 대상 Todo 준비
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withContent("기존 내용")
				.build();
			const updatedTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withContent(null)
				.build();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When - 내용 null로 설정
			const result = await service.updateContent(mockTodoId, mockUserId, {
				content: null,
			});

			// Then - 내용 삭제 검증
			expect(result.content).toBeNull();
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockTodoId },
					data: { content: null },
				}),
			);
		});

		it("존재하지 않는 Todo에 대해 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 Todo
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.updateContent(999, mockUserId, { title: "새 제목" }),
			).rejects.toThrow(BusinessException);
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

	// ============================================
	// 친구 투두 조회 통합 테스트
	// ============================================

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
			expect(mockDatabaseService.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: mockFriendUserId,
						visibility: "PUBLIC",
						AND: expect.arrayContaining([
							{ startDate: { lte: endDate } },
							{
								OR: [
									{ endDate: { gte: startDate } },
									{ endDate: null, startDate: { gte: startDate } },
								],
							},
						]),
					}),
				}),
			);
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
});
