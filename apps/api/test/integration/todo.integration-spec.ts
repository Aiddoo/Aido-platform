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
import { Test, type TestingModule } from "@nestjs/testing";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import type { Todo } from "@/generated/prisma/client";

import { FollowService } from "@/modules/follow/follow.service";
import { TodoRepository } from "@/modules/todo/todo.repository";
import { TodoService } from "@/modules/todo/todo.service";

describe("TodoService Integration Tests", () => {
	let module: TestingModule;
	let service: TodoService;
	let repository: TodoRepository;

	// Mock 데이터베이스 서비스
	const mockDatabaseService = {
		todo: {
			create: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
	};

	// Mock FollowService
	const mockFollowService = {
		isMutualFriend: jest.fn(),
	};

	// 테스트 데이터
	const mockUserId = "user-integration-123";
	const mockFriendUserId = "friend-user-456";
	const mockTodoId = 1;

	const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
		id: mockTodoId,
		userId: mockUserId,
		title: "통합 테스트 할 일",
		content: "통합 테스트 내용",
		color: "#3B82F6",
		startDate: new Date("2024-01-15"),
		endDate: new Date("2024-01-16"),
		scheduledTime: null,
		isAllDay: true,
		visibility: "PUBLIC",
		completed: false,
		completedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	});

	beforeAll(async () => {
		// Logger 출력 비활성화
		jest.spyOn(Logger.prototype, "log").mockImplementation();
		jest.spyOn(Logger.prototype, "warn").mockImplementation();
		jest.spyOn(Logger.prototype, "error").mockImplementation();
		jest.spyOn(Logger.prototype, "debug").mockImplementation();
	});

	beforeEach(async () => {
		jest.clearAllMocks();

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
					provide: TypedConfigService,
					useValue: {
						pagination: {
							defaultPageSize: 20,
							maxPageSize: 100,
						},
					},
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
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(TodoService);
		});

		it("TodoRepository가 올바르게 주입된다", () => {
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(TodoRepository);
		});
	});

	describe("create 통합 테스트", () => {
		it("Todo 생성이 Repository를 통해 올바르게 수행된다", async () => {
			// Given
			const mockTodo = createMockTodo();
			mockDatabaseService.todo.create.mockResolvedValue(mockTodo);

			const createInput = {
				userId: mockUserId,
				title: "새로운 할 일",
				content: "할 일 내용",
				startDate: new Date("2024-01-15"),
			};

			// When
			const result = await service.create(createInput);

			// Then
			expect(result).toEqual(mockTodo);
			expect(mockDatabaseService.todo.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					user: { connect: { id: mockUserId } },
					title: createInput.title,
					content: createInput.content,
				}),
			});
		});

		it("기본값이 올바르게 적용된다", async () => {
			// Given
			const mockTodo = createMockTodo({ isAllDay: true, visibility: "PUBLIC" });
			mockDatabaseService.todo.create.mockResolvedValue(mockTodo);

			const minimalInput = {
				userId: mockUserId,
				title: "최소 할 일",
				startDate: new Date("2024-01-15"),
			};

			// When
			await service.create(minimalInput);

			// Then
			expect(mockDatabaseService.todo.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					isAllDay: true,
					visibility: "PUBLIC",
				}),
			});
		});
	});

	describe("findById 통합 테스트", () => {
		it("존재하는 Todo를 조회한다", async () => {
			// Given
			const mockTodo = createMockTodo();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);

			// When
			const result = await service.findById(mockTodoId, mockUserId);

			// Then
			expect(result).toEqual(mockTodo);
		});

		it("존재하지 않는 Todo 조회 시 BusinessException을 던진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then
			await expect(service.findById(999, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 Todo 조회 시 BusinessException을 던진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then
			await expect(service.findById(mockTodoId, "other-user")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	describe("findMany 통합 테스트", () => {
		it("Todo 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const mockTodos = [
				createMockTodo({ id: 1 }),
				createMockTodo({ id: 2 }),
				createMockTodo({ id: 3 }),
			];
			mockDatabaseService.todo.findMany.mockResolvedValue(mockTodos);

			// When
			const result = await service.findMany({ userId: mockUserId });

			// Then
			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(result.pagination.hasNext).toBeDefined();
		});

		it("완료 상태 필터가 올바르게 적용된다", async () => {
			// Given
			const completedTodos = [createMockTodo({ id: 1, completed: true })];
			mockDatabaseService.todo.findMany.mockResolvedValue(completedTodos);

			// When
			await service.findMany({
				userId: mockUserId,
				completed: true,
			});

			// Then
			expect(mockDatabaseService.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						completed: true,
					}),
				}),
			);
		});

		it("날짜 범위 필터가 올바르게 적용된다", async () => {
			// Given
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");
			mockDatabaseService.todo.findMany.mockResolvedValue([]);

			// When
			await service.findMany({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then
			expect(mockDatabaseService.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						startDate: {
							gte: startDate,
							lte: endDate,
						},
					}),
				}),
			);
		});

		it("커서 기반 페이지네이션이 올바르게 작동한다", async () => {
			// Given
			mockDatabaseService.todo.findMany.mockResolvedValue([]);

			// When
			await service.findMany({
				userId: mockUserId,
				cursor: 10,
				size: 10,
			});

			// Then
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
			// Given
			const mockTodo = createMockTodo();
			const updatedTodo = createMockTodo({
				title: "수정된 제목",
				updatedAt: new Date(),
			});

			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When
			const result = await service.update(mockTodoId, mockUserId, {
				title: "수정된 제목",
			});

			// Then
			expect(result.title).toBe("수정된 제목");
		});

		it("완료 상태 변경 시 completedAt이 자동 설정된다", async () => {
			// Given
			const mockTodo = createMockTodo({ completed: false });
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(
				createMockTodo({ completed: true, completedAt: new Date() }),
			);

			// When
			await service.update(mockTodoId, mockUserId, { completed: true });

			// Then
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: expect.objectContaining({
					completed: true,
					completedAt: expect.any(Date),
				}),
			});
		});

		it("미완료로 변경 시 completedAt이 null로 설정된다", async () => {
			// Given
			const completedTodo = createMockTodo({
				completed: true,
				completedAt: new Date(),
			});
			mockDatabaseService.todo.findFirst.mockResolvedValue(completedTodo);
			mockDatabaseService.todo.update.mockResolvedValue(
				createMockTodo({ completed: false, completedAt: null }),
			);

			// When
			await service.update(mockTodoId, mockUserId, { completed: false });

			// Then
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: expect.objectContaining({
					completed: false,
					completedAt: null,
				}),
			});
		});

		it("존재하지 않는 Todo 수정 시 BusinessException을 던진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then
			await expect(
				service.update(999, mockUserId, { title: "수정" }),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("delete 통합 테스트", () => {
		it("Todo를 삭제한다", async () => {
			// Given
			const mockTodo = createMockTodo();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.delete.mockResolvedValue(mockTodo);

			// When
			await service.delete(mockTodoId, mockUserId);

			// Then
			expect(mockDatabaseService.todo.delete).toHaveBeenCalledWith({
				where: { id: mockTodoId },
			});
		});

		it("존재하지 않는 Todo 삭제 시 BusinessException을 던진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then
			await expect(service.delete(999, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 Todo 삭제 시 BusinessException을 던진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then
			await expect(service.delete(mockTodoId, "other-user")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	describe("에러 핸들링 통합 테스트", () => {
		it("Repository 에러가 적절하게 전파된다", async () => {
			// Given
			mockDatabaseService.todo.create.mockRejectedValue(
				new Error("Database connection failed"),
			);

			// When & Then
			await expect(
				service.create({
					userId: mockUserId,
					title: "테스트",
					startDate: new Date(),
				}),
			).rejects.toThrow("Database connection failed");
		});

		it("BusinessException이 적절하게 던져진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then
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
			// Given
			const mockTodo = createMockTodo({ completed: false, completedAt: null });
			const completedTodo = createMockTodo({
				completed: true,
				completedAt: new Date(),
			});
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(completedTodo);

			// When
			const result = await service.toggleComplete(mockTodoId, mockUserId, {
				completed: true,
			});

			// Then
			expect(result.completed).toBe(true);
			expect(result.completedAt).not.toBeNull();
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: expect.objectContaining({
					completed: true,
					completedAt: expect.any(Date),
				}),
			});
		});

		it("완료된 Todo를 미완료로 변경하면 completedAt이 null이 된다", async () => {
			// Given
			const completedTodo = createMockTodo({
				completed: true,
				completedAt: new Date("2024-01-10"),
			});
			const uncompletedTodo = createMockTodo({
				completed: false,
				completedAt: null,
			});
			mockDatabaseService.todo.findFirst.mockResolvedValue(completedTodo);
			mockDatabaseService.todo.update.mockResolvedValue(uncompletedTodo);

			// When
			const result = await service.toggleComplete(mockTodoId, mockUserId, {
				completed: false,
			});

			// Then
			expect(result.completed).toBe(false);
			expect(result.completedAt).toBeNull();
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: {
					completed: false,
					completedAt: null,
				},
			});
		});

		it("존재하지 않는 Todo에 대해 BusinessException을 던진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then
			await expect(
				service.toggleComplete(999, mockUserId, { completed: true }),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("updateVisibility 통합 테스트", () => {
		it("PUBLIC에서 PRIVATE로 변경한다", async () => {
			// Given
			const publicTodo = createMockTodo({ visibility: "PUBLIC" });
			const privateTodo = createMockTodo({ visibility: "PRIVATE" });
			mockDatabaseService.todo.findFirst.mockResolvedValue(publicTodo);
			mockDatabaseService.todo.update.mockResolvedValue(privateTodo);

			const input: { visibility: "PUBLIC" | "PRIVATE" } = {
				visibility: "PRIVATE",
			};

			// When
			const result = await service.updateVisibility(
				mockTodoId,
				mockUserId,
				input,
			);

			// Then
			expect(result.visibility).toBe("PRIVATE");
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: { visibility: "PRIVATE" },
			});
		});

		it("PRIVATE에서 PUBLIC으로 변경한다", async () => {
			// Given
			const privateTodo = createMockTodo({ visibility: "PRIVATE" });
			const publicTodo = createMockTodo({ visibility: "PUBLIC" });
			mockDatabaseService.todo.findFirst.mockResolvedValue(privateTodo);
			mockDatabaseService.todo.update.mockResolvedValue(publicTodo);

			const input: { visibility: "PUBLIC" | "PRIVATE" } = {
				visibility: "PUBLIC",
			};

			// When
			const result = await service.updateVisibility(
				mockTodoId,
				mockUserId,
				input,
			);

			// Then
			expect(result.visibility).toBe("PUBLIC");
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: { visibility: "PUBLIC" },
			});
		});

		it("존재하지 않는 Todo에 대해 BusinessException을 던진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			const input: { visibility: "PUBLIC" | "PRIVATE" } = {
				visibility: "PRIVATE",
			};

			// When & Then
			await expect(
				service.updateVisibility(999, mockUserId, input),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("updateColor 통합 테스트", () => {
		it("색상을 변경한다", async () => {
			// Given
			const mockTodo = createMockTodo({ color: "#FF5733" });
			const updatedTodo = createMockTodo({ color: "#00FF00" });
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When
			const result = await service.updateColor(mockTodoId, mockUserId, {
				color: "#00FF00",
			});

			// Then
			expect(result.color).toBe("#00FF00");
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: { color: "#00FF00" },
			});
		});

		it("색상을 null로 설정하여 제거한다", async () => {
			// Given
			const mockTodo = createMockTodo({ color: "#FF5733" });
			const updatedTodo = createMockTodo({ color: null });
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When
			const result = await service.updateColor(mockTodoId, mockUserId, {
				color: null,
			});

			// Then
			expect(result.color).toBeNull();
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: { color: null },
			});
		});

		it("존재하지 않는 Todo에 대해 BusinessException을 던진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then
			await expect(
				service.updateColor(999, mockUserId, { color: "#FF0000" }),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("updateSchedule 통합 테스트", () => {
		it("일정을 변경한다", async () => {
			// Given
			const mockTodo = createMockTodo();
			const updatedTodo = createMockTodo({
				startDate: new Date("2024-02-01"),
				endDate: new Date("2024-02-05"),
				scheduledTime: new Date("2024-02-01T14:30:00"),
				isAllDay: false,
			});
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			const input = {
				startDate: "2024-02-01",
				endDate: "2024-02-05",
				scheduledTime: "14:30",
				isAllDay: false,
			};

			// When
			const result = await service.updateSchedule(
				mockTodoId,
				mockUserId,
				input,
			);

			// Then
			expect(result.isAllDay).toBe(false);
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: expect.objectContaining({
					startDate: expect.any(Date),
					endDate: expect.any(Date),
					scheduledTime: expect.any(Date),
					isAllDay: false,
				}),
			});
		});

		it("endDate와 scheduledTime을 null로 설정할 수 있다", async () => {
			// Given
			const mockTodo = createMockTodo();
			const updatedTodo = createMockTodo({
				startDate: new Date("2024-02-01"),
				endDate: null,
				scheduledTime: null,
				isAllDay: true,
			});
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			const input = {
				startDate: "2024-02-01",
				endDate: null,
				scheduledTime: null,
				isAllDay: true,
			};

			// When
			await service.updateSchedule(mockTodoId, mockUserId, input);

			// Then
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: expect.objectContaining({
					startDate: expect.any(Date),
					endDate: null,
					scheduledTime: null,
					isAllDay: true,
				}),
			});
		});

		it("isAllDay를 생략하면 기본값 true를 사용한다", async () => {
			// Given
			const mockTodo = createMockTodo();
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(mockTodo);

			const input = {
				startDate: "2024-02-01",
			};

			// When
			await service.updateSchedule(mockTodoId, mockUserId, input);

			// Then
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: expect.objectContaining({
					isAllDay: true,
				}),
			});
		});

		it("존재하지 않는 Todo에 대해 BusinessException을 던진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then
			await expect(
				service.updateSchedule(999, mockUserId, { startDate: "2024-02-01" }),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("updateContent 통합 테스트", () => {
		it("제목만 변경한다", async () => {
			// Given
			const mockTodo = createMockTodo({ title: "기존 제목" });
			const updatedTodo = createMockTodo({ title: "새로운 제목" });
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When
			const result = await service.updateContent(mockTodoId, mockUserId, {
				title: "새로운 제목",
			});

			// Then
			expect(result.title).toBe("새로운 제목");
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: { title: "새로운 제목" },
			});
		});

		it("내용만 변경한다", async () => {
			// Given
			const mockTodo = createMockTodo({ content: "기존 내용" });
			const updatedTodo = createMockTodo({ content: "새로운 내용" });
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When
			const result = await service.updateContent(mockTodoId, mockUserId, {
				content: "새로운 내용",
			});

			// Then
			expect(result.content).toBe("새로운 내용");
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: { content: "새로운 내용" },
			});
		});

		it("제목과 내용을 동시에 변경한다", async () => {
			// Given
			const mockTodo = createMockTodo();
			const updatedTodo = createMockTodo({
				title: "새 제목",
				content: "새 내용",
			});
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When
			await service.updateContent(mockTodoId, mockUserId, {
				title: "새 제목",
				content: "새 내용",
			});

			// Then
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: {
					title: "새 제목",
					content: "새 내용",
				},
			});
		});

		it("내용을 null로 설정하여 삭제한다", async () => {
			// Given
			const mockTodo = createMockTodo({ content: "기존 내용" });
			const updatedTodo = createMockTodo({ content: null });
			mockDatabaseService.todo.findFirst.mockResolvedValue(mockTodo);
			mockDatabaseService.todo.update.mockResolvedValue(updatedTodo);

			// When
			const result = await service.updateContent(mockTodoId, mockUserId, {
				content: null,
			});

			// Then
			expect(result.content).toBeNull();
			expect(mockDatabaseService.todo.update).toHaveBeenCalledWith({
				where: { id: mockTodoId },
				data: { content: null },
			});
		});

		it("존재하지 않는 Todo에 대해 BusinessException을 던진다", async () => {
			// Given
			mockDatabaseService.todo.findFirst.mockResolvedValue(null);

			// When & Then
			await expect(
				service.updateContent(999, mockUserId, { title: "새 제목" }),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("동시성 시나리오 테스트", () => {
		it("여러 Todo를 동시에 생성할 수 있다", async () => {
			// Given
			let createCount = 0;
			mockDatabaseService.todo.create.mockImplementation(() => {
				createCount++;
				return Promise.resolve(createMockTodo({ id: createCount }));
			});

			// When
			const promises = [
				service.create({
					userId: mockUserId,
					title: "할 일 1",
					startDate: new Date(),
				}),
				service.create({
					userId: mockUserId,
					title: "할 일 2",
					startDate: new Date(),
				}),
				service.create({
					userId: mockUserId,
					title: "할 일 3",
					startDate: new Date(),
				}),
			];

			const results = await Promise.all(promises);

			// Then
			expect(results).toHaveLength(3);
			expect(mockDatabaseService.todo.create).toHaveBeenCalledTimes(3);
		});
	});

	// ============================================
	// 친구 투두 조회 통합 테스트
	// ============================================

	describe("findFriendTodos 통합 테스트", () => {
		it("맞팔 관계인 친구의 PUBLIC 투두를 조회한다", async () => {
			// Given
			const friendTodos = [
				createMockTodo({
					id: 1,
					userId: mockFriendUserId,
					visibility: "PUBLIC",
				}),
				createMockTodo({
					id: 2,
					userId: mockFriendUserId,
					visibility: "PUBLIC",
				}),
			];
			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockDatabaseService.todo.findMany.mockResolvedValue(friendTodos);

			// When
			const result = await service.findFriendTodos({
				userId: mockUserId,
				friendUserId: mockFriendUserId,
			});

			// Then
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
			// Given
			mockFollowService.isMutualFriend.mockResolvedValue(false);

			// When & Then
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
			// Given
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");
			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockDatabaseService.todo.findMany.mockResolvedValue([]);

			// When
			await service.findFriendTodos({
				userId: mockUserId,
				friendUserId: mockFriendUserId,
				startDate,
				endDate,
			});

			// Then
			expect(mockDatabaseService.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: mockFriendUserId,
						visibility: "PUBLIC",
						startDate: {
							gte: startDate,
							lte: endDate,
						},
					}),
				}),
			);
		});

		it("커서 기반 페이지네이션이 올바르게 작동한다", async () => {
			// Given
			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockDatabaseService.todo.findMany.mockResolvedValue([]);

			// When
			await service.findFriendTodos({
				userId: mockUserId,
				friendUserId: mockFriendUserId,
				cursor: 10,
				size: 10,
			});

			// Then
			expect(mockDatabaseService.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 1,
					cursor: { id: 10 },
				}),
			);
		});

		it("다음 페이지가 있는지 올바르게 판단한다", async () => {
			// Given
			const todos = [
				createMockTodo({ id: 1, userId: mockFriendUserId }),
				createMockTodo({ id: 2, userId: mockFriendUserId }),
				createMockTodo({ id: 3, userId: mockFriendUserId }),
			];
			mockFollowService.isMutualFriend.mockResolvedValue(true);
			// size + 1개를 반환해서 다음 페이지가 있음을 나타냄
			mockDatabaseService.todo.findMany.mockResolvedValue(todos);

			// When
			const result = await service.findFriendTodos({
				userId: mockUserId,
				friendUserId: mockFriendUserId,
				size: 2,
			});

			// Then
			expect(result.pagination.hasNext).toBe(true);
			expect(result.items).toHaveLength(2);
		});
	});
});
