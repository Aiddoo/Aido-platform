/**
 * TodoService 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - Builder: TodoBuilder, TodoCategoryBuilder로 테스트 데이터 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조 명확화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import { TODO_LIMITS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder, TodoCategoryBuilder } from "@test/builders";
import {
	BusinessException,
	BusinessExceptions,
} from "@/common/exception/services/business-exception.service";
import type {
	CursorPaginatedResponse,
	NormalizedCursorPagination,
} from "@/common/pagination";
import { PaginationService } from "@/common/pagination";
import { DatabaseService } from "@/database/database.service";
import type { Prisma } from "@/generated/prisma/client";

import { FollowService } from "../follow/follow.service";
import { NotificationQueueService } from "../notification/queue/notification-queue.service";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../scheduler/reminder";
import { TodoCategoryService } from "../todo-category/todo-category.service";

import { TodoRepository } from "./todo.repository";
import { TodoService } from "./todo.service";
import type {
	CreateRecurringTodoData,
	CreateTodoData,
	TodoWithCategory,
} from "./types/todo.types";

describe("TodoService", () => {
	let service: TodoService;
	let todoRepo: Mocked<TodoRepository>;
	let todoCategoryService: Mocked<TodoCategoryService>;
	let paginationService: Mocked<PaginationService>;
	let followService: Mocked<FollowService>;
	let database: Mocked<DatabaseService>;
	let reminderScheduler: Mocked<IReminderScheduler>;
	let notificationQueueService: Mocked<NotificationQueueService>;

	// 테스트 데이터
	const mockUserId = "user-123";

	beforeEach(async () => {
		// Given - ID 카운터 리셋으로 테스트 간 격리 보장
		TodoBuilder.resetIdCounter();
		TodoCategoryBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(TodoService)
			.mock(REMINDER_SCHEDULER)
			.impl(() => ({
				scheduleReminder: jest.fn(),
				cancelReminder: jest.fn(),
			}))
			.compile();

		service = unit;
		todoRepo = unitRef.get(TodoRepository);
		todoCategoryService = unitRef.get(TodoCategoryService);
		paginationService = unitRef.get(PaginationService);
		followService = unitRef.get(FollowService);
		database = unitRef.get(DatabaseService);
		reminderScheduler = unitRef.get(REMINDER_SCHEDULER);
		notificationQueueService = unitRef.get(NotificationQueueService);

		// Given - 기본 transaction mock 설정
		(database.$transaction as jest.Mock).mockImplementation(
			(callback: (tx: unknown) => Promise<unknown>) => callback(todoRepo),
		);
	});

	// ============================================
	// create
	// ============================================

	describe("create", () => {
		const createInput: CreateTodoData = {
			userId: mockUserId,
			title: "새로운 할 일",
			content: "할 일 내용",
			categoryId: 1,
			startDate: new Date("2024-01-15"),
			endDate: new Date("2024-01-16"),
			isAllDay: true,
			visibility: "PUBLIC",
		};

		beforeEach(() => {
			// Given - 카테고리당 활성 투두 0개 (제한 미도달)
			todoRepo.countActiveByCategory.mockResolvedValue(0);

			// Given - 카테고리와 Todo 생성 mock 설정
			const mockCategory = TodoCategoryBuilder.create(mockUserId)
				.withId(1)
				.withName("중요한 일")
				.build();

			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.withTitle(createInput.title)
				.withContent(createInput.content ?? null)
				.withCategoryId(createInput.categoryId)
				.build();

			todoCategoryService.validateOwnership.mockResolvedValue(mockCategory);
			todoRepo.getMaxSortOrder.mockResolvedValue(0);
			todoRepo.create.mockResolvedValue(mockTodo);
		});

		it("Todo를 생성하고 반환한다", async () => {
			// Given - beforeEach에서 설정됨

			// When - Todo 생성 요청
			const result = await service.create(createInput);

			// Then - 생성된 Todo가 올바르게 반환됨
			expect(result.title).toBe(createInput.title);
			expect(todoCategoryService.validateOwnership).toHaveBeenCalledWith(
				createInput.categoryId,
				mockUserId,
			);
			// TX 내에서 create 호출
			expect(database.$transaction).toHaveBeenCalled();
			const createArgs = todoRepo.create.mock.calls[0]?.[0];
			expect(createArgs).toEqual(
				expect.objectContaining({
					user: { connect: { id: mockUserId } },
					category: { connect: { id: createInput.categoryId } },
					title: createInput.title,
					content: createInput.content,
				}),
			);
		});

		it("선택 필드가 없으면 기본값을 사용한다", async () => {
			// Given - 최소 필드만 포함된 입력
			const minimalInput: CreateTodoData = {
				userId: mockUserId,
				title: "최소 할 일",
				categoryId: 1,
				startDate: new Date("2024-01-15"),
			};

			// When - 최소 필드로 Todo 생성
			await service.create(minimalInput);

			// Then - 기본값이 적용됨
			const createArgs = todoRepo.create.mock.calls[0]?.[0];
			expect(createArgs).toEqual(
				expect.objectContaining({
					isAllDay: true,
					visibility: "PUBLIC",
				}),
			);
		});

		it("content가 null이면 null로 저장한다", async () => {
			// Given - content가 null인 입력
			const inputWithNulls: CreateTodoData = {
				userId: mockUserId,
				title: "할 일",
				categoryId: 1,
				startDate: new Date("2024-01-15"),
				content: null,
			};

			// When - content가 null인 Todo 생성
			await service.create(inputWithNulls);

			// Then - content가 null로 저장됨
			const createArgs = todoRepo.create.mock.calls[0]?.[0];
			expect(createArgs).toEqual(
				expect.objectContaining({
					content: null,
				}),
			);
		});

		it("scheduledTime이 있으면 리마인더를 스케줄링한다", async () => {
			// Given - scheduledTime이 있는 Todo 생성
			const scheduledTime = new Date("2024-01-15T14:30:00Z");
			const inputWithSchedule: CreateTodoData = {
				...createInput,
				scheduledTime,
			};

			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.withTitle(createInput.title)
				.withScheduledTime(scheduledTime)
				.build();
			todoRepo.create.mockResolvedValue(mockTodo);

			// When - Todo 생성
			await service.create(inputWithSchedule);

			// Then - 리마인더가 스케줄링됨
			expect(reminderScheduler.scheduleReminder).toHaveBeenCalledWith(
				mockTodo.id,
				scheduledTime,
				mockUserId,
			);
		});

		it("scheduledTime이 없으면 리마인더를 스케줄링하지 않는다", async () => {
			// Given - scheduledTime이 없는 Todo 생성 (beforeEach에서 설정됨)

			// When - Todo 생성
			await service.create(createInput);

			// Then - 리마인더가 스케줄링되지 않음
			expect(reminderScheduler.scheduleReminder).not.toHaveBeenCalled();
		});

		it("존재하지 않는 카테고리면 에러를 던진다", async () => {
			// Given - 카테고리가 존재하지 않음
			todoCategoryService.validateOwnership.mockRejectedValue(
				BusinessExceptions.todoCategoryNotFound(999),
			);

			// When & Then: BusinessException 발생
			await expect(service.create(createInput)).rejects.toThrow(
				BusinessException,
			);
		});

		describe("리소스 제한 (카테고리당)", () => {
			it("카테고리당 활성 todo가 한도(300)에 도달하면 생성이 거부된다", async () => {
				// Given - 카테고리의 활성 todo가 한도(300)에 도달
				todoRepo.countActiveByCategory.mockResolvedValue(
					TODO_LIMITS.MAX_PER_CATEGORY,
				);

				// When & Then
				await expect(service.create(createInput)).rejects.toThrow(
					BusinessException,
				);
				expect(todoRepo.create).not.toHaveBeenCalled();
			});

			it("카테고리당 활성 todo가 한도 미만이면 생성에 성공한다", async () => {
				// Given - 카테고리의 활성 todo가 한도 미만
				todoRepo.countActiveByCategory.mockResolvedValue(
					TODO_LIMITS.MAX_PER_CATEGORY - 1,
				);

				// When
				const result = await service.create(createInput);

				// Then
				expect(result.title).toBe(createInput.title);
				expect(todoRepo.create).toHaveBeenCalled();
			});

			it("구독 유형에 관계없이 동일한 카테고리당 제한이 적용된다", async () => {
				// Given - 카테고리의 활성 todo가 한도 미만 (구독 무관)
				todoRepo.countActiveByCategory.mockResolvedValue(100);

				// When
				const result = await service.create(createInput);

				// Then
				expect(result.title).toBe(createInput.title);
				expect(todoRepo.create).toHaveBeenCalled();
			});
		});
	});

	// ============================================
	// findById
	// ============================================

	describe("findById", () => {
		it("Todo를 조회하고 반환한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);

			// When - Todo 조회
			const result = await service.findById(mockTodo.id, mockUserId);

			// Then - Todo가 반환됨
			expect(result.id).toBe(mockTodo.id);
			expect(todoRepo.findByIdAndUserId).toHaveBeenCalledWith(
				mockTodo.id,
				mockUserId,
			);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - Todo가 존재하지 않음
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(service.findById(999, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - 다른 사용자의 Todo 조회 시 null 반환
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(service.findById(mockTodo.id, "other-user")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// findMany
	// ============================================

	describe("findMany", () => {
		const mockTodos = [
			TodoBuilder.create(mockUserId)
				.withId(1)
				.withTitle("첫 번째 할 일")
				.build(),
			TodoBuilder.create(mockUserId)
				.withId(2)
				.withTitle("두 번째 할 일")
				.build(),
			TodoBuilder.create(mockUserId)
				.withId(3)
				.withTitle("세 번째 할 일")
				.build(),
		];

		const mockPaginatedResponse: CursorPaginatedResponse<
			TodoWithCategory,
			number
		> = {
			items: mockTodos,
			pagination: {
				nextCursor: 3,
				hasNext: false,
				size: 20,
			},
		};

		beforeEach(() => {
			// Given - 페이지네이션 및 조회 mock 설정
			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
				take: 21,
			} as NormalizedCursorPagination<number>);
			todoRepo.findManyByUserId.mockResolvedValue(mockTodos);
			paginationService.createCursorPaginatedResponse.mockReturnValue(
				mockPaginatedResponse as CursorPaginatedResponse<
					TodoWithCategory,
					number
				>,
			);
		});

		it("Todo 목록을 페이지네이션하여 반환한다", async () => {
			// Given - 기본 조회 파라미터
			const params = { userId: mockUserId };

			// When - Todo 목록 조회
			const result = await service.findMany(params);

			// Then - 페이지네이션된 결과 반환
			expect(result).toEqual(mockPaginatedResponse);
			expect(todoRepo.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
					size: 20,
				}),
			);
		});

		it("커서와 크기를 지정하여 조회할 수 있다", async () => {
			// Given - 커서와 크기가 지정된 파라미터
			const params = { userId: mockUserId, cursor: 1, size: 10 };
			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: 1,
				size: 10,
				take: 11,
			} as NormalizedCursorPagination<number>);

			// When - 커서 기반 조회
			await service.findMany(params);

			// Then - 지정된 커서와 크기로 조회
			expect(todoRepo.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({
					cursor: 1,
					size: 10,
				}),
			);
		});

		it("완료 상태로 필터링할 수 있다", async () => {
			// Given - 완료 상태 필터 파라미터
			const params = { userId: mockUserId, completed: true };

			// When - 완료 상태로 필터링
			await service.findMany(params);

			// Then - completed 필터가 적용됨
			expect(todoRepo.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({ completed: true }),
			);
		});

		it("날짜 범위로 필터링할 수 있다", async () => {
			// Given - 날짜 범위 필터 파라미터
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");
			const params = { userId: mockUserId, startDate, endDate };

			// When - 날짜 범위로 필터링
			await service.findMany(params);

			// Then - 날짜 범위 필터가 적용됨
			expect(todoRepo.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({ startDate, endDate }),
			);
		});

		it("startDate만 전달하면 해당 날짜로 필터링한다", async () => {
			// Given - startDate만 전달
			const startDate = new Date("2024-01-15");
			const params = { userId: mockUserId, startDate };

			// When - startDate만으로 필터링
			await service.findMany(params);

			// Then - startDate가 전달됨 (repository에서 exact match 처리)
			expect(todoRepo.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({ startDate, endDate: undefined }),
			);
		});

		it("endDate만 전달하면 해당 날짜로 필터링한다", async () => {
			// Given - endDate만 전달
			const endDate = new Date("2024-01-15");
			const params = { userId: mockUserId, endDate };

			// When - endDate만으로 필터링
			await service.findMany(params);

			// Then - endDate가 전달됨 (repository에서 exact match 처리)
			expect(todoRepo.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({ startDate: undefined, endDate }),
			);
		});

		it("startDate가 endDate보다 이후면 SYS_0002 에러를 던진다", async () => {
			// Given - 잘못된 날짜 범위
			const params = {
				userId: mockUserId,
				startDate: new Date("2024-02-03"),
				endDate: new Date("2024-02-02"),
			};

			// When & Then: BusinessException 발생
			await expect(service.findMany(params)).rejects.toThrow(BusinessException);
			expect(todoRepo.findManyByUserId).not.toHaveBeenCalled();
		});

		it("카테고리로 필터링할 수 있다", async () => {
			// Given - 카테고리 필터 파라미터
			const params = { userId: mockUserId, categoryId: 1 };

			// When - 카테고리로 필터링
			await service.findMany(params);

			// Then - categoryId 필터가 적용됨
			expect(todoRepo.findManyByUserId).toHaveBeenCalledWith(
				expect.objectContaining({ categoryId: 1 }),
			);
		});
	});

	// ============================================
	// update
	// ============================================

	describe("update", () => {
		const updateInput = { title: "수정된 할 일", content: "수정된 내용" };

		it("Todo를 수정하고 반환한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			const updatedTodo: TodoWithCategory = {
				...mockTodo,
				...updateInput,
				updatedAt: new Date(),
			};
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockResolvedValue(updatedTodo);

			// When - Todo 수정
			const result = await service.update(mockTodo.id, mockUserId, updateInput);

			// Then - 수정된 Todo 반환
			expect(result.title).toBe(updateInput.title);
			expect(todoRepo.update).toHaveBeenCalledWith(
				mockTodo.id,
				expect.objectContaining({
					title: updateInput.title,
					content: updateInput.content,
				}),
			);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - Todo가 존재하지 않음
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(
				service.update(999, mockUserId, updateInput),
			).rejects.toThrow(BusinessException);
		});

		it("다른 사용자의 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - 다른 사용자의 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(
				service.update(mockTodo.id, "other-user", updateInput),
			).rejects.toThrow(BusinessException);
		});

		it("미완료에서 완료로 변경 시 completedAt이 설정된다", async () => {
			// Given - 미완료 상태의 Todo
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.uncompleted()
				.build();
			const updatedTodo: TodoWithCategory = {
				...mockTodo,
				completed: true,
				completedAt: new Date(),
				updatedAt: new Date(),
			};
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockResolvedValue(updatedTodo);

			// When - 완료 상태로 변경
			const completeInput = { completed: true };
			await service.update(mockTodo.id, mockUserId, completeInput);

			// Then - completedAt이 설정됨
			expect(todoRepo.update).toHaveBeenCalledWith(
				mockTodo.id,
				expect.objectContaining({
					completed: true,
					completedAt: expect.any(Date),
				}),
			);
		});

		it("완료에서 미완료로 변경 시 completedAt이 null로 설정된다", async () => {
			// Given - 완료 상태의 Todo
			const completedTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.completed()
				.build();
			const updatedTodo: TodoWithCategory = {
				...completedTodo,
				completed: false,
				completedAt: null,
				updatedAt: new Date(),
			};
			todoRepo.findByIdAndUserId.mockResolvedValue(completedTodo);
			todoRepo.update.mockResolvedValue(updatedTodo);

			// When - 미완료 상태로 변경
			const uncompleteInput = { completed: false };
			await service.update(completedTodo.id, mockUserId, uncompleteInput);

			// Then - completedAt이 null로 설정됨
			expect(todoRepo.update).toHaveBeenCalledWith(
				completedTodo.id,
				expect.objectContaining({
					completed: false,
					completedAt: null,
				}),
			);
		});

		it("이미 완료된 상태에서 다시 완료로 설정해도 completedAt이 변경되지 않는다", async () => {
			// Given - 이미 완료된 Todo
			const completedTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.completed(new Date("2024-01-10"))
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(completedTodo);
			todoRepo.update.mockResolvedValue(completedTodo);

			// When - 다시 완료로 설정
			const completeInput = { completed: true };
			await service.update(completedTodo.id, mockUserId, completeInput);

			// Then - completedAt이 새로 설정되지 않음
			expect(todoRepo.update).toHaveBeenCalledWith(
				completedTodo.id,
				expect.objectContaining({ completed: true }),
			);
			const updateCallArg = todoRepo.update.mock.calls[0]?.[1] as
				| Record<string, unknown>
				| undefined;
			expect(updateCallArg?.completedAt).toBeUndefined();
		});

		it("완료로 변경 시 리마인더를 취소한다", async () => {
			// Given - 미완료 상태의 Todo
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.uncompleted()
				.build();
			const updatedTodo: TodoWithCategory = {
				...mockTodo,
				completed: true,
				completedAt: new Date(),
				updatedAt: new Date(),
			};
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockResolvedValue(updatedTodo);

			// When - 완료 상태로 변경
			await service.update(mockTodo.id, mockUserId, { completed: true });

			// Then - 리마인더가 취소됨
			expect(reminderScheduler.cancelReminder).toHaveBeenCalledWith(
				mockTodo.id,
			);
		});

		it("카테고리를 변경할 때 존재하지 않는 카테고리면 에러를 던진다", async () => {
			// Given - 존재하지 않는 카테고리로 변경 시도
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoCategoryService.validateOwnership.mockRejectedValue(
				BusinessExceptions.todoCategoryNotFound(999),
			);
			const updateWithCategory = { categoryId: 999 };

			// When & Then: BusinessException 발생
			await expect(
				service.update(mockTodo.id, mockUserId, updateWithCategory),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// delete
	// ============================================

	describe("delete", () => {
		it("Todo를 삭제한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.delete.mockResolvedValue(mockTodo);

			// When - Todo 삭제
			await service.delete(mockTodo.id, mockUserId);

			// Then - delete가 호출됨
			expect(todoRepo.delete).toHaveBeenCalledWith(mockTodo.id);
		});

		it("삭제 시 리마인더를 취소한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.delete.mockResolvedValue(mockTodo);

			// When - Todo 삭제
			await service.delete(mockTodo.id, mockUserId);

			// Then - 리마인더가 취소됨
			expect(reminderScheduler.cancelReminder).toHaveBeenCalledWith(
				mockTodo.id,
			);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - Todo가 존재하지 않음
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(service.delete(999, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - 다른 사용자의 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(service.delete(mockTodo.id, "other-user")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// toggleComplete (SRP)
	// ============================================

	describe("toggleComplete", () => {
		it("미완료 Todo를 완료로 변경하면 completedAt이 설정된다", async () => {
			// Given - 미완료 상태의 Todo
			const uncompletedTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.uncompleted()
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(uncompletedTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...uncompletedTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - 완료로 변경
			const result = await service.toggleComplete(
				uncompletedTodo.id,
				mockUserId,
				{ completed: true },
			);

			// Then - completed와 completedAt이 설정됨
			expect(result.completed).toBe(true);
			expect(todoRepo.update).toHaveBeenCalledWith(
				uncompletedTodo.id,
				expect.objectContaining({
					completed: true,
					completedAt: expect.any(Date),
				}),
			);
		});

		it("완료된 Todo를 미완료로 변경하면 completedAt이 null이 된다", async () => {
			// Given - 완료 상태의 Todo
			const completedTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.completed(new Date("2024-01-10"))
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(completedTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...completedTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - 미완료로 변경
			const result = await service.toggleComplete(
				completedTodo.id,
				mockUserId,
				{ completed: false },
			);

			// Then - completed가 false이고 completedAt이 null
			expect(result.completed).toBe(false);
			expect(todoRepo.update).toHaveBeenCalledWith(
				completedTodo.id,
				expect.objectContaining({
					completed: false,
					completedAt: null,
				}),
			);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - Todo가 존재하지 않음
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(
				service.toggleComplete(999, mockUserId, { completed: true }),
			).rejects.toThrow(BusinessException);
		});

		it("다른 사용자의 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - 다른 사용자의 Todo
			const uncompletedTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.uncompleted()
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(
				service.toggleComplete(uncompletedTodo.id, "other-user", {
					completed: true,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("완료로 변경 시 리마인더를 취소한다", async () => {
			// Given - 미완료 상태의 Todo
			const uncompletedTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.uncompleted()
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(uncompletedTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...uncompletedTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - 완료로 변경
			await service.toggleComplete(uncompletedTodo.id, mockUserId, {
				completed: true,
			});

			// Then - 리마인더가 취소됨
			expect(reminderScheduler.cancelReminder).toHaveBeenCalledWith(
				uncompletedTodo.id,
			);
		});

		it("미완료로 변경 시 리마인더를 취소하지 않는다", async () => {
			// Given - 완료 상태의 Todo
			const completedTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.completed(new Date("2024-01-10"))
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(completedTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...completedTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - 미완료로 변경
			await service.toggleComplete(completedTodo.id, mockUserId, {
				completed: false,
			});

			// Then - 리마인더 취소가 호출되지 않음
			expect(reminderScheduler.cancelReminder).not.toHaveBeenCalled();
		});

		it("완료 시 누적 카운트가 마일스톤이면 enqueueMilestoneReached를 호출한다", async () => {
			// Given - 미완료 상태의 Todo + 누적 완료 10개 (마일스톤)
			const uncompletedTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.uncompleted()
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(uncompletedTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...uncompletedTodo,
						...data,
					}) as TodoWithCategory,
			);
			todoRepo.countCompletedByUser.mockResolvedValue(10);

			// When - 완료로 변경
			await service.toggleComplete(uncompletedTodo.id, mockUserId, {
				completed: true,
			});

			// Then - fire-and-forget 비동기 처리 대기
			await new Promise((resolve) => setImmediate(resolve));

			// Then - enqueueMilestoneReached가 호출됨
			expect(
				notificationQueueService.enqueueMilestoneReached,
			).toHaveBeenCalledWith({
				userId: mockUserId,
				milestone: "COUNT_10",
			});
		});

		it("누적 카운트가 마일스톤이 아니면 enqueueMilestoneReached를 호출하지 않는다", async () => {
			// Given - 미완료 상태의 Todo + 누적 완료 7개 (마일스톤 아님)
			const uncompletedTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.uncompleted()
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(uncompletedTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...uncompletedTodo,
						...data,
					}) as TodoWithCategory,
			);
			todoRepo.countCompletedByUser.mockResolvedValue(7);

			// When - 완료로 변경
			await service.toggleComplete(uncompletedTodo.id, mockUserId, {
				completed: true,
			});

			// Then - fire-and-forget 비동기 처리 대기
			await new Promise((resolve) => setImmediate(resolve));

			// Then - enqueueMilestoneReached가 호출되지 않음
			expect(
				notificationQueueService.enqueueMilestoneReached,
			).not.toHaveBeenCalled();
		});

		it("마일스톤 체크 실패해도 toggleComplete는 정상 완료한다", async () => {
			// Given - 미완료 상태의 Todo + DB 에러
			const uncompletedTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.uncompleted()
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(uncompletedTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...uncompletedTodo,
						...data,
					}) as TodoWithCategory,
			);
			todoRepo.countCompletedByUser.mockRejectedValue(new Error("DB error"));

			// When - 완료로 변경
			const result = await service.toggleComplete(
				uncompletedTodo.id,
				mockUserId,
				{ completed: true },
			);

			// Then - fire-and-forget이므로 toggleComplete는 정상 완료
			expect(result.completed).toBe(true);
		});
	});

	// ============================================
	// updateVisibility (SRP)
	// ============================================

	describe("updateVisibility", () => {
		it("PUBLIC에서 PRIVATE로 변경한다", async () => {
			// Given - PUBLIC 상태의 Todo
			const publicTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.asPublic()
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(publicTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...publicTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - PRIVATE로 변경
			const result = await service.updateVisibility(publicTodo.id, mockUserId, {
				visibility: "PRIVATE",
			});

			// Then - visibility가 PRIVATE로 변경됨
			expect(result.visibility).toBe("PRIVATE");
			expect(todoRepo.update).toHaveBeenCalledWith(publicTodo.id, {
				visibility: "PRIVATE",
			});
		});

		it("PRIVATE에서 PUBLIC으로 변경한다", async () => {
			// Given - PRIVATE 상태의 Todo
			const privateTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.asPrivate()
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(privateTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...privateTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - PUBLIC으로 변경
			const result = await service.updateVisibility(
				privateTodo.id,
				mockUserId,
				{ visibility: "PUBLIC" },
			);

			// Then - visibility가 PUBLIC으로 변경됨
			expect(result.visibility).toBe("PUBLIC");
			expect(todoRepo.update).toHaveBeenCalledWith(privateTodo.id, {
				visibility: "PUBLIC",
			});
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - Todo가 존재하지 않음
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(
				service.updateVisibility(999, mockUserId, { visibility: "PRIVATE" }),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// updateCategory (SRP)
	// ============================================

	describe("updateCategory", () => {
		it("카테고리를 변경한다", async () => {
			// Given - 존재하는 Todo와 새 카테고리 (미완료 → TX 사용)
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.uncompleted()
				.build();
			const newCategory = TodoCategoryBuilder.create(mockUserId)
				.withId(2)
				.withName("할 일")
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoCategoryService.validateOwnership.mockResolvedValue(newCategory);
			todoRepo.countActiveByCategory.mockResolvedValue(0);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) => {
					const categoryData = data.category as
						| { connect?: { id: number } }
						| undefined;
					return {
						...mockTodo,
						...data,
						category: {
							id: categoryData?.connect?.id ?? 1,
							name: "할 일",
							color: "#FF6B43",
							sortOrder: 0,
						},
					} as TodoWithCategory;
				},
			);

			// When - 카테고리 변경
			const result = await service.updateCategory(mockTodo.id, mockUserId, {
				categoryId: 2,
			});

			// Then - 카테고리가 변경됨 (TX 내에서 check + update)
			expect(result.category.id).toBe(2);
			expect(database.$transaction).toHaveBeenCalled();
			expect(todoRepo.countActiveByCategory).toHaveBeenCalled();
			expect(todoRepo.update).toHaveBeenCalled();
			const updateArgs = todoRepo.update.mock.calls[0];
			expect(updateArgs?.[0]).toBe(mockTodo.id);
			expect(updateArgs?.[1]).toEqual({
				category: { connect: { id: 2 } },
			});
		});

		it("존재하지 않는 카테고리면 에러를 던진다", async () => {
			// Given - 존재하지 않는 카테고리
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoCategoryService.validateOwnership.mockRejectedValue(
				BusinessExceptions.todoCategoryNotFound(999),
			);

			// When & Then: BusinessException 발생
			await expect(
				service.updateCategory(mockTodo.id, mockUserId, { categoryId: 999 }),
			).rejects.toThrow(BusinessException);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - Todo가 존재하지 않음
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(
				service.updateCategory(999, mockUserId, { categoryId: 1 }),
			).rejects.toThrow(BusinessException);
		});

		it("활성 투두 이동 시 대상 카테고리가 꽉 찼으면 에러를 던진다", async () => {
			// Given - 미완료 Todo, 대상 카테고리가 한도에 도달
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.uncompleted()
				.build();
			const newCategory = TodoCategoryBuilder.create(mockUserId)
				.withId(2)
				.withName("할 일")
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoCategoryService.validateOwnership.mockResolvedValue(newCategory);
			todoRepo.countActiveByCategory.mockResolvedValue(
				TODO_LIMITS.MAX_PER_CATEGORY,
			);

			// When & Then: BusinessException 발생
			await expect(
				service.updateCategory(mockTodo.id, mockUserId, { categoryId: 2 }),
			).rejects.toThrow(BusinessException);
			expect(todoRepo.update).not.toHaveBeenCalled();
		});

		it("완료된 투두 이동 시 대상 카테고리가 꽉 차도 이동할 수 있다", async () => {
			// Given - 완료된 Todo, 대상 카테고리가 한도에 도달
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.completed()
				.build();
			const newCategory = TodoCategoryBuilder.create(mockUserId)
				.withId(2)
				.withName("할 일")
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoCategoryService.validateOwnership.mockResolvedValue(newCategory);
			todoRepo.countActiveByCategory.mockResolvedValue(
				TODO_LIMITS.MAX_PER_CATEGORY,
			);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) => {
					const categoryData = data.category as
						| { connect?: { id: number } }
						| undefined;
					return {
						...mockTodo,
						...data,
						category: {
							id: categoryData?.connect?.id ?? 1,
							name: "할 일",
							color: "#FF6B43",
							sortOrder: 0,
						},
					} as TodoWithCategory;
				},
			);

			// When - 카테고리 변경
			const result = await service.updateCategory(mockTodo.id, mockUserId, {
				categoryId: 2,
			});

			// Then - 완료된 투두는 이동 가능
			expect(result.category.id).toBe(2);
			expect(todoRepo.update).toHaveBeenCalled();
		});
	});

	// ============================================
	// updateSchedule (SRP)
	// ============================================

	describe("updateSchedule", () => {
		it("일정을 변경한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...mockTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - 일정 변경
			const input = {
				startDate: "2024-02-01",
				endDate: "2024-02-05",
				scheduledTime: "14:30",
				isAllDay: false,
			};
			await service.updateSchedule(mockTodo.id, mockUserId, input);

			// Then - 일정이 변경됨
			expect(todoRepo.update).toHaveBeenCalledWith(
				mockTodo.id,
				expect.objectContaining({
					startDate: expect.any(Date),
					endDate: expect.any(Date),
					scheduledTime: expect.any(Date),
					isAllDay: false,
				}),
			);
		});

		it("endDate와 scheduledTime을 null로 설정할 수 있다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...mockTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - endDate와 scheduledTime을 null로 설정
			const input = {
				startDate: "2024-02-01",
				endDate: null,
				scheduledTime: null,
				isAllDay: true,
			};
			await service.updateSchedule(mockTodo.id, mockUserId, input);

			// Then - null 값이 적용됨
			expect(todoRepo.update).toHaveBeenCalledWith(
				mockTodo.id,
				expect.objectContaining({
					startDate: expect.any(Date),
					endDate: null,
					scheduledTime: null,
					isAllDay: true,
				}),
			);
		});

		it("isAllDay를 생략하면 기본값 true를 사용한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...mockTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - isAllDay를 생략
			const input = { startDate: "2024-02-01" };
			await service.updateSchedule(mockTodo.id, mockUserId, input);

			// Then - isAllDay가 기본값 true로 설정됨
			expect(todoRepo.update).toHaveBeenCalledWith(
				mockTodo.id,
				expect.objectContaining({ isAllDay: true }),
			);
		});

		it("scheduledTime 설정 시 리마인더를 스케줄링한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			const scheduledTime = new Date("2024-02-01T14:30:00Z");
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockResolvedValue({
				...mockTodo,
				scheduledTime,
				title: mockTodo.title,
			});

			// When - scheduledTime을 설정
			await service.updateSchedule(mockTodo.id, mockUserId, {
				startDate: "2024-02-01",
				scheduledTime: "14:30",
				isAllDay: false,
			});

			// Then - 리마인더가 스케줄링됨
			expect(reminderScheduler.scheduleReminder).toHaveBeenCalledWith(
				mockTodo.id,
				scheduledTime,
				mockUserId,
			);
		});

		it("scheduledTime을 null로 설정 시 리마인더를 취소한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId).withId(1).build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockResolvedValue({
				...mockTodo,
				scheduledTime: null,
			});

			// When - scheduledTime을 null로 설정
			await service.updateSchedule(mockTodo.id, mockUserId, {
				startDate: "2024-02-01",
				scheduledTime: null,
				isAllDay: true,
			});

			// Then - 리마인더가 취소됨
			expect(reminderScheduler.cancelReminder).toHaveBeenCalledWith(
				mockTodo.id,
			);
			expect(reminderScheduler.scheduleReminder).not.toHaveBeenCalled();
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - Todo가 존재하지 않음
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(
				service.updateSchedule(999, mockUserId, { startDate: "2024-02-01" }),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// updateContent (SRP)
	// ============================================

	describe("updateContent", () => {
		it("제목만 변경한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.withTitle("원래 제목")
				.withContent("원래 내용")
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...mockTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - 제목만 변경
			const result = await service.updateContent(mockTodo.id, mockUserId, {
				title: "새로운 제목",
			});

			// Then - 제목만 변경됨
			expect(result.title).toBe("새로운 제목");
			expect(todoRepo.update).toHaveBeenCalledWith(mockTodo.id, {
				title: "새로운 제목",
			});
		});

		it("내용만 변경한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.withTitle("원래 제목")
				.withContent("원래 내용")
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...mockTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - 내용만 변경
			const result = await service.updateContent(mockTodo.id, mockUserId, {
				content: "새로운 내용",
			});

			// Then - 내용만 변경됨
			expect(result.content).toBe("새로운 내용");
			expect(todoRepo.update).toHaveBeenCalledWith(mockTodo.id, {
				content: "새로운 내용",
			});
		});

		it("제목과 내용을 동시에 변경한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.withTitle("원래 제목")
				.withContent("원래 내용")
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...mockTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - 제목과 내용 동시 변경
			await service.updateContent(mockTodo.id, mockUserId, {
				title: "새 제목",
				content: "새 내용",
			});

			// Then - 둘 다 변경됨
			expect(todoRepo.update).toHaveBeenCalledWith(mockTodo.id, {
				title: "새 제목",
				content: "새 내용",
			});
		});

		it("내용을 null로 설정하여 삭제한다", async () => {
			// Given - 존재하는 Todo
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.withTitle("원래 제목")
				.withContent("원래 내용")
				.build();
			todoRepo.findByIdAndUserId.mockResolvedValue(mockTodo);
			todoRepo.update.mockImplementation(
				async (_id: number, data: Record<string, unknown>) =>
					({
						...mockTodo,
						...data,
					}) as TodoWithCategory,
			);

			// When - 내용을 null로 설정
			const result = await service.updateContent(mockTodo.id, mockUserId, {
				content: null,
			});

			// Then - 내용이 null로 설정됨
			expect(result.content).toBeNull();
			expect(todoRepo.update).toHaveBeenCalledWith(mockTodo.id, {
				content: null,
			});
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - Todo가 존재하지 않음
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(
				service.updateContent(999, mockUserId, { title: "새 제목" }),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// reorder
	// ============================================

	describe("reorder", () => {
		it("Todo를 특정 위치 앞으로 이동한다", async () => {
			// Given - 이동할 Todo와 타겟 Todo
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(1)
				.withSortOrder(0)
				.build();
			const targetTodo = TodoBuilder.create(mockUserId)
				.withId(2)
				.withSortOrder(2)
				.build();
			todoRepo.findByIdAndUserId
				.mockResolvedValueOnce(mockTodo)
				.mockResolvedValueOnce(targetTodo);
			todoRepo.shiftSortOrders.mockResolvedValue(1);
			todoRepo.updateSortOrder.mockResolvedValue({
				...mockTodo,
				sortOrder: 1,
			});

			// When - 타겟 앞으로 이동
			const result = await service.reorder(mockTodo.id, mockUserId, {
				targetTodoId: 2,
				position: "before",
			});

			// Then - sortOrder가 변경됨
			expect(result.sortOrder).toBe(1);
		});

		it("존재하지 않는 Todo면 TODO_NOT_FOUND 에러를 던진다", async () => {
			// Given - Todo가 존재하지 않음
			todoRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: BusinessException 발생
			await expect(
				service.reorder(999, mockUserId, { position: "before" }),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// findFriendTodos
	// ============================================

	describe("findFriendTodos", () => {
		const friendUserId = "friend-user-456";

		it("맞팔 관계일 때 친구의 PUBLIC 투두 목록을 반환한다", async () => {
			// Given - 맞팔 관계의 친구와 PUBLIC Todo
			const mockFriendTodos = [
				TodoBuilder.create(friendUserId)
					.withId(10)
					.withTitle("친구의 할 일 1")
					.asPublic()
					.build(),
				TodoBuilder.create(friendUserId)
					.withId(11)
					.withTitle("친구의 할 일 2")
					.asPublic()
					.build(),
			];
			const mockPaginatedResponse: CursorPaginatedResponse<
				TodoWithCategory,
				number
			> = {
				items: mockFriendTodos,
				pagination: {
					nextCursor: 11,
					hasNext: false,
					size: 20,
				},
			};
			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
				take: 21,
			} as NormalizedCursorPagination<number>);
			followService.isMutualFriend.mockResolvedValue(true);
			todoRepo.findPublicTodosByUserId.mockResolvedValue(mockFriendTodos);
			paginationService.createCursorPaginatedResponse.mockReturnValue(
				mockPaginatedResponse as CursorPaginatedResponse<
					TodoWithCategory,
					number
				>,
			);

			// When - 친구 Todo 조회
			const result = await service.findFriendTodos({
				userId: mockUserId,
				friendUserId,
			});

			// Then - 친구의 PUBLIC Todo 목록 반환
			expect(result).toEqual(mockPaginatedResponse);
			expect(followService.isMutualFriend).toHaveBeenCalledWith(
				mockUserId,
				friendUserId,
			);
			expect(todoRepo.findPublicTodosByUserId).toHaveBeenCalledWith(
				expect.objectContaining({
					friendUserId,
					size: 20,
				}),
			);
		});

		it("맞팔 관계가 아니면 FOLLOW_0906 에러를 던진다", async () => {
			// Given - 맞팔 관계가 아님
			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
				take: 21,
			} as NormalizedCursorPagination<number>);
			followService.isMutualFriend.mockResolvedValue(false);

			// When & Then: BusinessException 발생
			await expect(
				service.findFriendTodos({ userId: mockUserId, friendUserId }),
			).rejects.toThrow(BusinessException);
			expect(todoRepo.findPublicTodosByUserId).not.toHaveBeenCalled();
		});

		it("커서와 크기를 지정하여 조회할 수 있다", async () => {
			// Given - 커서와 크기가 지정된 파라미터
			const mockFriendTodos = [
				TodoBuilder.create(friendUserId).withId(10).asPublic().build(),
			];
			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: 5,
				size: 10,
				take: 11,
			} as NormalizedCursorPagination<number>);
			followService.isMutualFriend.mockResolvedValue(true);
			todoRepo.findPublicTodosByUserId.mockResolvedValue(mockFriendTodos);
			paginationService.createCursorPaginatedResponse.mockReturnValue({
				items: mockFriendTodos,
				pagination: {
					nextCursor: null,
					hasNext: false,
					size: 10,
				},
			} as CursorPaginatedResponse<TodoWithCategory, number>);

			// When - 커서 기반 조회
			await service.findFriendTodos({
				userId: mockUserId,
				friendUserId,
				cursor: 5,
				size: 10,
			});

			// Then - 지정된 커서와 크기로 조회
			expect(todoRepo.findPublicTodosByUserId).toHaveBeenCalledWith(
				expect.objectContaining({ cursor: 5, size: 10 }),
			);
		});

		it("날짜 범위로 필터링할 수 있다", async () => {
			// Given - 날짜 범위 필터
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");
			const mockFriendTodos = [
				TodoBuilder.create(friendUserId).withId(10).asPublic().build(),
			];
			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
				take: 21,
			} as NormalizedCursorPagination<number>);
			followService.isMutualFriend.mockResolvedValue(true);
			todoRepo.findPublicTodosByUserId.mockResolvedValue(mockFriendTodos);
			paginationService.createCursorPaginatedResponse.mockReturnValue({
				items: mockFriendTodos,
				pagination: {
					nextCursor: null,
					hasNext: false,
					size: 20,
				},
			} as CursorPaginatedResponse<TodoWithCategory, number>);

			// When - 날짜 범위로 필터링
			await service.findFriendTodos({
				userId: mockUserId,
				friendUserId,
				startDate,
				endDate,
			});

			// Then - 날짜 범위 필터가 적용됨
			expect(todoRepo.findPublicTodosByUserId).toHaveBeenCalledWith(
				expect.objectContaining({ friendUserId, startDate, endDate }),
			);
		});

		it("startDate가 endDate보다 이후면 SYS_0002 에러를 던진다", async () => {
			// Given - 잘못된 날짜 범위
			const startDate = new Date("2024-02-03");
			const endDate = new Date("2024-02-02");

			// When & Then: BusinessException 발생
			await expect(
				service.findFriendTodos({
					userId: mockUserId,
					friendUserId,
					startDate,
					endDate,
				}),
			).rejects.toThrow(BusinessException);
			expect(followService.isMutualFriend).not.toHaveBeenCalled();
			expect(todoRepo.findPublicTodosByUserId).not.toHaveBeenCalled();
		});
	});

	// ============================================
	// createRecurring
	// ============================================

	describe("createRecurring", () => {
		const recurringInput: CreateRecurringTodoData = {
			userId: mockUserId,
			title: "약 먹기",
			content: "매일 비타민 복용",
			categoryId: 1,
			startDate: "2026-03-01",
			endDate: "2026-03-31",
			daysOfWeek: ["MON", "WED", "FRI"],
		};

		const mockCategory = TodoCategoryBuilder.create(mockUserId)
			.withId(1)
			.withName("건강")
			.withColor("#4CAF50")
			.build();

		beforeEach(() => {
			// Given - 카테고리당 활성 투두 0개 (제한 미도달)
			todoRepo.countActiveByCategory.mockResolvedValue(0);

			// Given - 카테고리 소유권 확인 통과
			todoCategoryService.validateOwnership.mockResolvedValue(mockCategory);

			// Given - sortOrder 기본값
			todoRepo.getMaxSortOrder.mockResolvedValue(0);

			// Given - createManyBatch mock (flat 포맷: TodoCreateManyInput)
			todoRepo.createManyBatch.mockImplementation(
				async (dataArray: Prisma.TodoCreateManyInput[]) =>
					dataArray.map((data, index) =>
						TodoBuilder.create(mockUserId)
							.withId(index + 1)
							.withTitle(data.title)
							.withSortOrder(data.sortOrder ?? 0)
							.withRecurrenceGroupId("test-uuid")
							.build(),
					),
			);
		});

		it("날짜 범위와 요일에 맞는 Todo들을 일괄 생성한다", async () => {
			// Given - 3/1~3/31 월수금 (2026년 3월)

			// When - 반복 Todo 생성
			const result = await service.createRecurring(recurringInput);

			// Then - 월수금에 해당하는 날짜만큼 Todo가 생성됨 (13개)
			expect(result.count).toBe(13);
			expect(result.todos).toHaveLength(13);

			// Then - 올바른 데이터로 createManyBatch이 호출됨 (flat 포맷)
			const createInputs = todoRepo.createManyBatch.mock
				.calls[0]?.[0] as Prisma.TodoCreateManyInput[];
			expect(createInputs).toHaveLength(13);
			expect(createInputs[0]).toEqual(
				expect.objectContaining({
					title: "약 먹기",
					userId: mockUserId,
					categoryId: 1,
					content: "매일 비타민 복용",
					visibility: "PUBLIC",
					isAllDay: true,
				}),
			);
		});

		it("각 Todo에 순차적 sortOrder를 할당한다", async () => {
			// Given - 기존 maxSortOrder가 5
			todoRepo.getMaxSortOrder.mockResolvedValue(5);

			// When - 반복 Todo 생성
			await service.createRecurring(recurringInput);

			// Then - sortOrder가 6부터 순차적으로 할당됨
			const createInputs = todoRepo.createManyBatch.mock
				.calls[0]?.[0] as Prisma.TodoCreateManyInput[];
			expect(createInputs[0]?.sortOrder).toBe(6);
			expect(createInputs[1]?.sortOrder).toBe(7);
			expect(createInputs[createInputs.length - 1]?.sortOrder).toBe(
				5 + createInputs.length,
			);
		});

		it("동일한 recurrenceGroupId를 부여한다", async () => {
			// Given - beforeEach에서 설정됨

			// When - 반복 Todo 생성
			await service.createRecurring(recurringInput);

			// Then - 모든 Todo에 동일한 recurrenceGroupId가 할당됨
			const createInputs = todoRepo.createManyBatch.mock
				.calls[0]?.[0] as Prisma.TodoCreateManyInput[];
			const groupId = createInputs[0]?.recurrenceGroupId;
			expect(groupId).toBeDefined();
			expect(typeof groupId).toBe("string");
			for (const input of createInputs) {
				expect(input.recurrenceGroupId).toBe(groupId);
			}
		});

		it("scheduledTime 제공 시 각 날짜별로 생성 데이터에 포함된다", async () => {
			// Given - scheduledTime이 있는 입력
			const inputWithTime: CreateRecurringTodoData = {
				...recurringInput,
				scheduledTime: "09:00",
				isAllDay: false,
			};

			// When - 반복 Todo 생성
			await service.createRecurring(inputWithTime, "Asia/Seoul");

			// Then - 각 Todo에 scheduledTime이 설정됨
			const createInputs = todoRepo.createManyBatch.mock
				.calls[0]?.[0] as Prisma.TodoCreateManyInput[];
			for (const input of createInputs) {
				expect(input.scheduledTime).toBeInstanceOf(Date);
				expect(input.isAllDay).toBe(false);
			}
		});

		it("scheduledTime이 있는 Todo에 대해 리마인더 스케줄링을 호출한다", async () => {
			// Given - scheduledTime이 있는 Todo가 생성됨
			const scheduledTime = new Date("2026-03-02T00:00:00Z");
			todoRepo.createManyBatch.mockResolvedValue(
				Array.from({ length: 3 }, (_, i) =>
					TodoBuilder.create(mockUserId)
						.withId(i + 1)
						.withTitle("약 먹기")
						.withScheduledTime(scheduledTime)
						.withRecurrenceGroupId("test-uuid")
						.build(),
				),
			);

			const inputWithTime: CreateRecurringTodoData = {
				...recurringInput,
				startDate: "2026-03-02",
				endDate: "2026-03-06",
				daysOfWeek: ["MON", "WED", "FRI"],
				scheduledTime: "09:00",
			};

			// When - 반복 Todo 생성
			await service.createRecurring(inputWithTime, "Asia/Seoul");

			// Then - 각 Todo에 대해 리마인더 스케줄링이 호출됨
			expect(reminderScheduler.scheduleReminder).toHaveBeenCalledTimes(3);
		});

		it("매칭 날짜가 0개이면 invalidParameter 에러를 던진다", async () => {
			// Given - 기간 내 해당 요일이 없는 입력 (3/1~3/2는 일/월)
			const noMatchInput: CreateRecurringTodoData = {
				...recurringInput,
				startDate: "2026-03-01",
				endDate: "2026-03-01",
				daysOfWeek: ["TUE"], // 3/1은 일요일
			};

			// When & Then: BusinessException 발생
			await expect(service.createRecurring(noMatchInput)).rejects.toThrow(
				BusinessException,
			);
			expect(todoRepo.createManyBatch).not.toHaveBeenCalled();
		});

		it("인스턴스가 100개를 초과하면 TODO_0812 에러를 던진다", async () => {
			// Given - 넓은 범위와 매일 반복으로 100개 초과
			const tooManyInput: CreateRecurringTodoData = {
				...recurringInput,
				startDate: "2026-01-01",
				endDate: "2026-12-31",
				daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
			};

			// When & Then: BusinessException 발생
			await expect(service.createRecurring(tooManyInput)).rejects.toThrow(
				BusinessException,
			);
			expect(todoRepo.createManyBatch).not.toHaveBeenCalled();
		});

		it("카테고리 활성 투두 + batchSize가 카테고리 한도를 초과하면 TODO_0813 에러를 던진다", async () => {
			// Given - 카테고리에 활성 todo가 295개 (295+13 > 300)
			todoRepo.countActiveByCategory.mockResolvedValue(295);

			// When & Then: BusinessException 발생
			await expect(service.createRecurring(recurringInput)).rejects.toThrow(
				BusinessException,
			);
			expect(todoRepo.createManyBatch).not.toHaveBeenCalled();
		});

		it("카테고리 한도 내이면 리소스 체크를 통과한다", async () => {
			// Given - 카테고리에 활성 todo가 100개 (100+13 <= 300)
			todoRepo.countActiveByCategory.mockResolvedValue(100);

			// When - 반복 Todo 생성
			const result = await service.createRecurring(recurringInput);

			// Then - 정상 생성됨
			expect(result.count).toBe(13);
			expect(todoRepo.createManyBatch).toHaveBeenCalled();
		});

		it("카테고리 소유권 실패 시 예외가 전파된다", async () => {
			// Given - 카테고리 소유권 확인 실패
			todoCategoryService.validateOwnership.mockRejectedValue(
				BusinessExceptions.todoCategoryNotFound(999),
			);

			const inputWithBadCategory: CreateRecurringTodoData = {
				...recurringInput,
				categoryId: 999,
			};

			// When & Then: BusinessException 발생
			await expect(
				service.createRecurring(inputWithBadCategory),
			).rejects.toThrow(BusinessException);
			expect(todoRepo.createManyBatch).not.toHaveBeenCalled();
		});

		it("리마인더 스케줄링 실패해도 생성 결과는 정상 반환된다", async () => {
			// Given - 리마인더 스케줄링이 실패하도록 설정
			const scheduledTime = new Date("2026-03-02T00:00:00Z");
			todoRepo.createManyBatch.mockResolvedValue(
				Array.from({ length: 2 }, (_, i) =>
					TodoBuilder.create(mockUserId)
						.withId(i + 1)
						.withTitle("약 먹기")
						.withScheduledTime(scheduledTime)
						.withRecurrenceGroupId("test-uuid")
						.build(),
				),
			);
			reminderScheduler.scheduleReminder.mockImplementation(() => {
				throw new Error("Scheduler error");
			});

			const inputWithTime: CreateRecurringTodoData = {
				...recurringInput,
				startDate: "2026-03-02",
				endDate: "2026-03-04",
				daysOfWeek: ["MON", "WED"],
				scheduledTime: "09:00",
			};

			// When - 반복 Todo 생성
			const result = await service.createRecurring(inputWithTime, "Asia/Seoul");

			// Then - 생성 결과는 정상 반환 (리마인더 실패는 무시)
			expect(result.count).toBe(2);
			expect(result.todos).toHaveLength(2);
		});
	});
});
