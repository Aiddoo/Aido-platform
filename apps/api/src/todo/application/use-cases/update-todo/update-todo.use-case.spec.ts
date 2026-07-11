/**
 * UpdateTodoUseCase 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 * 오라클: 레거시 TodoService.update 분기(completedAt 전이 3분기·카테고리 캐시·이벤트) 재현
 */

import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import {
	createCategoryOwnershipMock,
	createTodoCacheMock,
	createTodoReadRepositoryMock,
	createTodoRepositoryMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";
import {
	DOMAIN_EVENT_PUBLISHER,
	type DomainEventPublisherPort,
	UNIT_OF_WORK,
} from "@/shared/application/ports";
import { Todo } from "../../../domain/entities/todo.entity";
import { TodoUpdatedEvent } from "../../../domain/events/todo-updated.event";
import { TodoId } from "../../../domain/value-objects/todo-id.vo";
import { TodoSchedule } from "../../../domain/value-objects/todo-schedule.vo";
import { TodoMapper } from "../../../infrastructure/persistence/todo-response.mapper";
import {
	CATEGORY_OWNERSHIP,
	type CategoryOwnershipPort,
} from "../../ports/category-ownership.port";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { UpdateTodoUseCase } from "./update-todo.use-case";

/** 소유권 확인용 애그리게잇 */
function buildEntity(overrides: { completed?: boolean } = {}): Todo {
	return Todo.reconstitute({
		id: TodoId.create(1),
		userId: "user-123",
		title: "할 일",
		categoryId: 1,
		sortOrder: 0,
		completed: overrides.completed ?? false,
		completedAt: overrides.completed ? new Date("2026-01-01") : null,
		schedule: TodoSchedule.reconstitute({
			startDate: new Date("2026-02-22"),
			endDate: null,
			scheduledTime: null,
			isAllDay: true,
		}),
		visibility: "PUBLIC",
		recurrenceGroupId: null,
		items: [],
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
	});
}

/** 재조회 시 반환할 응답 read model */
function buildResponse(): TodoResponse {
	return TodoMapper.toResponse(
		TodoBuilder.create("user-123").withId(1).withTitle("할 일").build(),
	);
}

describe("UpdateTodoUseCase — 할 일 부분 수정 핸들러", () => {
	let useCase: UpdateTodoUseCase;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let categoryOwnership: Mocked<CategoryOwnershipPort>;
	let todoCache: Mocked<TodoCachePort>;
	let eventPublisher: Mocked<DomainEventPublisherPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(UpdateTodoUseCase)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.mock<CategoryOwnershipPort>(CATEGORY_OWNERSHIP)
			.impl(() => createCategoryOwnershipMock())
			.mock<TodoCachePort>(TODO_CACHE)
			.impl(() => createTodoCacheMock())
			.mock<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER)
			.impl(() => ({ publishAll: jest.fn() }))
			.compile();

		useCase = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		categoryOwnership = unitRef.get<CategoryOwnershipPort>(CATEGORY_OWNERSHIP);
		todoCache = unitRef.get<TodoCachePort>(TODO_CACHE);
		eventPublisher = unitRef.get<DomainEventPublisherPort>(
			DOMAIN_EVENT_PUBLISHER,
		);
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({ id: 999, userId: "user-123", data: { title: "x" } }),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.updateDetails).not.toHaveBeenCalled();
	});

	it("제목만 수정하면 패치를 영속화하고 응답을 재조회한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await useCase.execute({
			id: 1,
			userId: "user-123",
			data: { title: "새 제목" },
		});

		// Then - completedAt 미포함 패치 + 캐시/소유권 확인 없음
		expect(todoRepository.updateDetails).toHaveBeenCalledWith(1, {
			title: "새 제목",
		});
		expect(categoryOwnership.validateOwnership).not.toHaveBeenCalled();
		expect(todoCache.invalidateTodoCategories).not.toHaveBeenCalled();
		expect(result.id).toBe(1);
	});

	it("미완료→완료 전이 시 completedAt을 패치에 포함하고 TodoUpdatedEvent를 발행한다", async () => {
		// Given - 미완료 할 일
		todoRepository.findByIdAndUserId.mockResolvedValue(
			buildEntity({ completed: false }),
		);
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await useCase.execute({
			id: 1,
			userId: "user-123",
			data: { completed: true },
		});

		// Then - 전이 패치 + 저장 후 이벤트 발행(이벤트 핸들러가 리마인더 취소)
		expect(todoRepository.updateDetails).toHaveBeenCalledWith(1, {
			completed: true,
			completedAt: expect.any(Date),
		});
		expect(eventPublisher.publishAll).toHaveBeenCalledWith([
			new TodoUpdatedEvent(1, "user-123", true),
		]);
	});

	it("완료→미완료 전이 시 completedAt=null을 패치에 포함한다", async () => {
		// Given - 완료 상태 할 일
		todoRepository.findByIdAndUserId.mockResolvedValue(
			buildEntity({ completed: true }),
		);
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await useCase.execute({
			id: 1,
			userId: "user-123",
			data: { completed: false },
		});

		// Then
		expect(todoRepository.updateDetails).toHaveBeenCalledWith(1, {
			completed: false,
			completedAt: null,
		});
	});

	it("같은 완료 상태로 재요청하면 completedAt을 패치에 포함하지 않는다 (레거시 동작 보존)", async () => {
		// Given - 이미 완료된 할 일에 completed=true 재요청
		todoRepository.findByIdAndUserId.mockResolvedValue(
			buildEntity({ completed: true }),
		);
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await useCase.execute({
			id: 1,
			userId: "user-123",
			data: { completed: true },
		});

		// Then - completedAt 없이 completed만
		expect(todoRepository.updateDetails).toHaveBeenCalledWith(1, {
			completed: true,
		});
	});

	it("카테고리 변경 시 소유권을 확인하고 캐시를 무효화한다 (활성 한도 재체크는 없음)", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await useCase.execute({
			id: 1,
			userId: "user-123",
			data: { categoryId: 2 },
		});

		// Then - 소유권 확인 + 캐시 무효화, 한도 카운트 조회는 없음 (레거시 동작 보존)
		expect(categoryOwnership.validateOwnership).toHaveBeenCalledWith(
			2,
			"user-123",
		);
		expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
		expect(todoRepository.countActiveByCategory).not.toHaveBeenCalled();
	});

	it("대상 카테고리 소유권 확인에 실패하면 패치를 영속화하지 않는다", async () => {
		// Given - 소유권 검증 실패
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		categoryOwnership.validateOwnership.mockRejectedValue(
			new Error("not owner"),
		);

		// When & Then
		await expect(
			useCase.execute({ id: 1, userId: "user-123", data: { categoryId: 9 } }),
		).rejects.toThrow("not owner");
		expect(todoRepository.updateDetails).not.toHaveBeenCalled();
	});
});
