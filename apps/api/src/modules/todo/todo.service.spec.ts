import { Test, type TestingModule } from "@nestjs/testing";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import type { Todo } from "@/generated/prisma/client";

import { TodoRepository } from "./todo.repository";
import { type CreateTodoData, TodoService } from "./todo.service";

describe("TodoService", () => {
	let service: TodoService;

	// Mock 객체들
	const mockTodoRepository = {
		create: jest.fn(),
		findById: jest.fn(),
		findByIdAndUserId: jest.fn(),
		findManyByUserId: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
	};

	const mockPaginationService = {
		normalizeCursorPagination: jest.fn(),
		createCursorPaginatedResponse: jest.fn(),
	};

	// 테스트 데이터
	const mockUserId = "user-123";
	const mockTodoId = 1;

	const mockTodo: Todo = {
		id: mockTodoId,
		userId: mockUserId,
		title: "테스트 할 일",
		content: "테스트 내용",
		color: "#FF5733",
		startDate: new Date("2024-01-15"),
		endDate: new Date("2024-01-16"),
		scheduledTime: null,
		isAllDay: true,
		visibility: "PUBLIC",
		completed: false,
		completedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TodoService,
				{ provide: TodoRepository, useValue: mockTodoRepository },
				{ provide: PaginationService, useValue: mockPaginationService },
			],
		}).compile();

		service = module.get<TodoService>(TodoService);
	});

	// ============================================
	// create
	// ============================================

	describe("create", () => {
		const createInput: CreateTodoData = {
			userId: mockUserId,
			title: "새로운 할 일",
			content: "할 일 내용",
			color: "#FF5733",
			startDate: new Date("2024-01-15"),
			endDate: new Date("2024-01-16"),
			isAllDay: true,
			visibility: "PUBLIC",
		};

		beforeEach(() => {
			mockTodoRepository.create.mockResolvedValue(mockTodo);
		});

		it("Todo를 생성하고 반환한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			const result = await service.create(createInput);

			// Then
			expect(result).toEqual(mockTodo);
			expect(mockTodoRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					user: { connect: { id: mockUserId } },
					title: createInput.title,
					content: createInput.content,
					color: createInput.color,
				}),
			);
		});

		it("선택 필드가 없으면 기본값을 사용한다", async () => {
			// Given
			const minimalInput = {
				userId: mockUserId,
				title: "최소 할 일",
				startDate: new Date("2024-01-15"),
			};

			// When
			await service.create(minimalInput);

			// Then
			expect(mockTodoRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					isAllDay: true,
					visibility: "PUBLIC",
				}),
			);
		});

		it("content와 color가 null이면 null로 저장한다", async () => {
			// Given
			const inputWithNulls = {
				userId: mockUserId,
				title: "할 일",
				startDate: new Date("2024-01-15"),
				content: null,
				color: null,
			};

			// When
			await service.create(inputWithNulls);

			// Then
			expect(mockTodoRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					content: null,
					color: null,
				}),
			);
		});
	});

	// ============================================
	// findById
	// ============================================

	describe("findById", () => {
		beforeEach(() => {
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(mockTodo);
		});

		it("Todo를 조회하고 반환한다", async () => {
			// Given
			// - beforeEach에서 유효한 Todo 설정됨

			// When
			const result = await service.findById(mockTodoId, mockUserId);

			// Then
			expect(result).toEqual(mockTodo);
			expect(mockTodoRepository.findByIdAndUserId).toHaveBeenCalledWith(
				mockTodoId,
				mockUserId,
			);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(service.findById(999, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(service.findById(mockTodoId, "other-user")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// findMany
	// ============================================

	describe("findMany", () => {
		const mockTodos: Todo[] = [
			mockTodo,
			{ ...mockTodo, id: 2, title: "두 번째 할 일" },
			{ ...mockTodo, id: 3, title: "세 번째 할 일" },
		];

		const mockPaginatedResponse = {
			items: mockTodos,
			pagination: {
				nextCursor: 3,
				prevCursor: null,
				hasNext: false,
				hasPrevious: false,
			},
		};

		beforeEach(() => {
			mockPaginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
			});
			mockTodoRepository.findManyByUserId.mockResolvedValue(mockTodos);
			mockPaginationService.createCursorPaginatedResponse.mockReturnValue(
				mockPaginatedResponse,
			);
		});

		it("Todo 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const params = {
				userId: mockUserId,
			};

			// When
			const result = await service.findMany(params);

			// Then
			expect(result).toEqual(mockPaginatedResponse);
			expect(mockTodoRepository.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
					size: 20,
				}),
			);
		});

		it("커서와 크기를 지정하여 조회할 수 있다", async () => {
			// Given
			const params = {
				userId: mockUserId,
				cursor: 1,
				size: 10,
			};

			mockPaginationService.normalizeCursorPagination.mockReturnValue({
				cursor: 1,
				size: 10,
			});

			// When
			await service.findMany(params);

			// Then
			expect(mockTodoRepository.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({
					cursor: 1,
					size: 10,
				}),
			);
		});

		it("완료 상태로 필터링할 수 있다", async () => {
			// Given
			const params = {
				userId: mockUserId,
				completed: true,
			};

			// When
			await service.findMany(params);

			// Then
			expect(mockTodoRepository.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({
					completed: true,
				}),
			);
		});

		it("날짜 범위로 필터링할 수 있다", async () => {
			// Given
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");
			const params = {
				userId: mockUserId,
				startDate,
				endDate,
			};

			// When
			await service.findMany(params);

			// Then
			expect(mockTodoRepository.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({
					startDate,
					endDate,
				}),
			);
		});
	});

	// ============================================
	// update
	// ============================================

	describe("update", () => {
		const updateInput = {
			title: "수정된 할 일",
			content: "수정된 내용",
		};

		const updatedTodo: Todo = {
			...mockTodo,
			...updateInput,
			updatedAt: new Date(),
		};

		beforeEach(() => {
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(mockTodo);
			mockTodoRepository.update.mockResolvedValue(updatedTodo);
		});

		it("Todo를 수정하고 반환한다", async () => {
			// Given
			// - beforeEach에서 유효한 Todo 설정됨

			// When
			const result = await service.update(mockTodoId, mockUserId, updateInput);

			// Then
			expect(result).toEqual(updatedTodo);
			expect(mockTodoRepository.update).toHaveBeenCalledWith(
				mockTodoId,
				expect.objectContaining({
					title: updateInput.title,
					content: updateInput.content,
				}),
			);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.update(999, mockUserId, updateInput),
			).rejects.toThrow(BusinessException);
		});

		it("다른 사용자의 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.update(mockTodoId, "other-user", updateInput),
			).rejects.toThrow(BusinessException);
		});

		it("미완료에서 완료로 변경 시 completedAt이 설정된다", async () => {
			// Given
			const completeInput = { completed: true };

			// When
			await service.update(mockTodoId, mockUserId, completeInput);

			// Then
			expect(mockTodoRepository.update).toHaveBeenCalledWith(
				mockTodoId,
				expect.objectContaining({
					completed: true,
					completedAt: expect.any(Date),
				}),
			);
		});

		it("완료에서 미완료로 변경 시 completedAt이 null로 설정된다", async () => {
			// Given
			const completedTodo: Todo = {
				...mockTodo,
				completed: true,
				completedAt: new Date(),
			};
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(completedTodo);

			const uncompleteInput = { completed: false };

			// When
			await service.update(mockTodoId, mockUserId, uncompleteInput);

			// Then
			expect(mockTodoRepository.update).toHaveBeenCalledWith(
				mockTodoId,
				expect.objectContaining({
					completed: false,
					completedAt: null,
				}),
			);
		});

		it("이미 완료된 상태에서 다시 완료로 설정해도 completedAt이 변경되지 않는다", async () => {
			// Given
			const completedTodo: Todo = {
				...mockTodo,
				completed: true,
				completedAt: new Date("2024-01-10"),
			};
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(completedTodo);

			const completeInput = { completed: true };

			// When
			await service.update(mockTodoId, mockUserId, completeInput);

			// Then
			expect(mockTodoRepository.update).toHaveBeenCalledWith(
				mockTodoId,
				expect.objectContaining({
					completed: true,
				}),
			);
			// completedAt이 새로 설정되지 않아야 함
			const updateCallArg = mockTodoRepository.update.mock.calls[0][1];
			expect(updateCallArg.completedAt).toBeUndefined();
		});
	});

	// ============================================
	// delete
	// ============================================

	describe("delete", () => {
		beforeEach(() => {
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(mockTodo);
			mockTodoRepository.delete.mockResolvedValue(mockTodo);
		});

		it("Todo를 삭제한다", async () => {
			// Given
			// - beforeEach에서 유효한 Todo 설정됨

			// When
			await service.delete(mockTodoId, mockUserId);

			// Then
			expect(mockTodoRepository.delete).toHaveBeenCalledWith(mockTodoId);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(service.delete(999, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(service.delete(mockTodoId, "other-user")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// toggleComplete (SRP)
	// ============================================

	describe("toggleComplete", () => {
		const uncompletedTodo: Todo = {
			...mockTodo,
			completed: false,
			completedAt: null,
		};

		const completedTodo: Todo = {
			...mockTodo,
			completed: true,
			completedAt: new Date("2024-01-10"),
		};

		beforeEach(() => {
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(uncompletedTodo);
			mockTodoRepository.update.mockImplementation((_id, data) => ({
				...uncompletedTodo,
				...data,
			}));
		});

		it("미완료 Todo를 완료로 변경하면 completedAt이 설정된다", async () => {
			// Given
			const input = { completed: true };

			// When
			const result = await service.toggleComplete(
				mockTodoId,
				mockUserId,
				input,
			);

			// Then
			expect(result.completed).toBe(true);
			expect(mockTodoRepository.update).toHaveBeenCalledWith(
				mockTodoId,
				expect.objectContaining({
					completed: true,
					completedAt: expect.any(Date),
				}),
			);
		});

		it("완료된 Todo를 미완료로 변경하면 completedAt이 null이 된다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(completedTodo);
			const input = { completed: false };

			// When
			const result = await service.toggleComplete(
				mockTodoId,
				mockUserId,
				input,
			);

			// Then
			expect(result.completed).toBe(false);
			expect(mockTodoRepository.update).toHaveBeenCalledWith(
				mockTodoId,
				expect.objectContaining({
					completed: false,
					completedAt: null,
				}),
			);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.toggleComplete(999, mockUserId, { completed: true }),
			).rejects.toThrow(BusinessException);
		});

		it("다른 사용자의 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.toggleComplete(mockTodoId, "other-user", { completed: true }),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// updateVisibility (SRP)
	// ============================================

	describe("updateVisibility", () => {
		const publicTodo: Todo = { ...mockTodo, visibility: "PUBLIC" };

		beforeEach(() => {
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(publicTodo);
			mockTodoRepository.update.mockImplementation((_id, data) => ({
				...publicTodo,
				...data,
			}));
		});

		it("PUBLIC에서 PRIVATE로 변경한다", async () => {
			// Given
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
			expect(mockTodoRepository.update).toHaveBeenCalledWith(mockTodoId, {
				visibility: "PRIVATE",
			});
		});

		it("PRIVATE에서 PUBLIC으로 변경한다", async () => {
			// Given
			const privateTodo: Todo = { ...mockTodo, visibility: "PRIVATE" };
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(privateTodo);

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
			expect(mockTodoRepository.update).toHaveBeenCalledWith(mockTodoId, {
				visibility: "PUBLIC",
			});
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.updateVisibility(999, mockUserId, { visibility: "PRIVATE" }),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// updateColor (SRP)
	// ============================================

	describe("updateColor", () => {
		beforeEach(() => {
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(mockTodo);
			mockTodoRepository.update.mockImplementation((_id, data) => ({
				...mockTodo,
				...data,
			}));
		});

		it("색상을 변경한다", async () => {
			// Given
			const input = { color: "#00FF00" };

			// When
			const result = await service.updateColor(mockTodoId, mockUserId, input);

			// Then
			expect(result.color).toBe("#00FF00");
			expect(mockTodoRepository.update).toHaveBeenCalledWith(mockTodoId, {
				color: "#00FF00",
			});
		});

		it("색상을 null로 설정하여 제거한다", async () => {
			// Given
			const input = { color: null };

			// When
			const result = await service.updateColor(mockTodoId, mockUserId, input);

			// Then
			expect(result.color).toBeNull();
			expect(mockTodoRepository.update).toHaveBeenCalledWith(mockTodoId, {
				color: null,
			});
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.updateColor(999, mockUserId, { color: "#FF0000" }),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// updateSchedule (SRP)
	// ============================================

	describe("updateSchedule", () => {
		beforeEach(() => {
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(mockTodo);
			mockTodoRepository.update.mockImplementation((_id, data) => ({
				...mockTodo,
				...data,
			}));
		});

		it("일정을 변경한다", async () => {
			// Given
			const input = {
				startDate: "2024-02-01",
				endDate: "2024-02-05",
				scheduledTime: "14:30",
				isAllDay: false,
			};

			// When
			await service.updateSchedule(mockTodoId, mockUserId, input);

			// Then
			expect(mockTodoRepository.update).toHaveBeenCalledWith(
				mockTodoId,
				expect.objectContaining({
					startDate: expect.any(Date),
					endDate: expect.any(Date),
					scheduledTime: expect.any(Date),
					isAllDay: false,
				}),
			);
		});

		it("endDate와 scheduledTime을 null로 설정할 수 있다", async () => {
			// Given
			const input = {
				startDate: "2024-02-01",
				endDate: null,
				scheduledTime: null,
				isAllDay: true,
			};

			// When
			await service.updateSchedule(mockTodoId, mockUserId, input);

			// Then
			expect(mockTodoRepository.update).toHaveBeenCalledWith(
				mockTodoId,
				expect.objectContaining({
					startDate: expect.any(Date),
					endDate: null,
					scheduledTime: null,
					isAllDay: true,
				}),
			);
		});

		it("isAllDay를 생략하면 기본값 true를 사용한다", async () => {
			// Given
			const input = {
				startDate: "2024-02-01",
			};

			// When
			await service.updateSchedule(mockTodoId, mockUserId, input);

			// Then
			expect(mockTodoRepository.update).toHaveBeenCalledWith(
				mockTodoId,
				expect.objectContaining({
					isAllDay: true,
				}),
			);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.updateSchedule(999, mockUserId, { startDate: "2024-02-01" }),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// updateContent (SRP)
	// ============================================

	describe("updateContent", () => {
		beforeEach(() => {
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(mockTodo);
			mockTodoRepository.update.mockImplementation((_id, data) => ({
				...mockTodo,
				...data,
			}));
		});

		it("제목만 변경한다", async () => {
			// Given
			const input = { title: "새로운 제목" };

			// When
			const result = await service.updateContent(mockTodoId, mockUserId, input);

			// Then
			expect(result.title).toBe("새로운 제목");
			expect(mockTodoRepository.update).toHaveBeenCalledWith(mockTodoId, {
				title: "새로운 제목",
			});
		});

		it("내용만 변경한다", async () => {
			// Given
			const input = { content: "새로운 내용" };

			// When
			const result = await service.updateContent(mockTodoId, mockUserId, input);

			// Then
			expect(result.content).toBe("새로운 내용");
			expect(mockTodoRepository.update).toHaveBeenCalledWith(mockTodoId, {
				content: "새로운 내용",
			});
		});

		it("제목과 내용을 동시에 변경한다", async () => {
			// Given
			const input = { title: "새 제목", content: "새 내용" };

			// When
			await service.updateContent(mockTodoId, mockUserId, input);

			// Then
			expect(mockTodoRepository.update).toHaveBeenCalledWith(mockTodoId, {
				title: "새 제목",
				content: "새 내용",
			});
		});

		it("내용을 null로 설정하여 삭제한다", async () => {
			// Given
			const input = { content: null };

			// When
			const result = await service.updateContent(mockTodoId, mockUserId, input);

			// Then
			expect(result.content).toBeNull();
			expect(mockTodoRepository.update).toHaveBeenCalledWith(mockTodoId, {
				content: null,
			});
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockTodoRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.updateContent(999, mockUserId, { title: "새 제목" }),
			).rejects.toThrow(BusinessException);
		});
	});
});
