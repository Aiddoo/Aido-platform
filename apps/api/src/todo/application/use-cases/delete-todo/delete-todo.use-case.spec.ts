/**
 * DeleteTodoUseCase 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 */

import { ErrorCode } from "@aido/errors";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	createTodoCacheMock,
	createTodoRepositoryMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";
import {
	DOMAIN_EVENT_PUBLISHER,
	type DomainEventPublisherPort,
	UNIT_OF_WORK,
} from "@/shared/application/ports";
import { Todo } from "../../../domain/entities/todo.entity";
import { TodoDeletedEvent } from "../../../domain/events/todo-deleted.event";
import { TodoId } from "../../../domain/value-objects/todo-id.vo";
import { TodoSchedule } from "../../../domain/value-objects/todo-schedule.vo";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import { DeleteTodoUseCase } from "./delete-todo.use-case";

function buildEntity(): Todo {
	return Todo.reconstitute({
		id: TodoId.create(1),
		userId: "user-123",
		title: "할 일",
		categoryId: 1,
		sortOrder: 0,
		completed: false,
		completedAt: null,
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

describe("DeleteTodoUseCase — 할 일 삭제 핸들러", () => {
	let useCase: DeleteTodoUseCase;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoCache: Mocked<TodoCachePort>;
	let eventPublisher: Mocked<DomainEventPublisherPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(DeleteTodoUseCase)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoCachePort>(TODO_CACHE)
			.impl(() => createTodoCacheMock())
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.mock<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER)
			.impl(() => ({ publishAll: jest.fn().mockResolvedValue(undefined) }))
			.compile();

		useCase = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoCache = unitRef.get<TodoCachePort>(TODO_CACHE);
		eventPublisher = unitRef.get<DomainEventPublisherPort>(
			DOMAIN_EVENT_PUBLISHER,
		);
	});

	it("삭제 후 TodoDeletedEvent를 발행하고 캐시를 무효화한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());

		// When
		await useCase.execute({ id: 1, userId: "user-123" });

		// Then - 삭제 → 이벤트(리마인더 취소는 이벤트 핸들러) → 캐시
		expect(todoRepository.delete).toHaveBeenCalledWith(1);
		expect(eventPublisher.publishAll).toHaveBeenCalledWith([
			new TodoDeletedEvent(1, "user-123"),
		]);
		expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
		expect(todoCache.invalidateFriendTodos).toHaveBeenCalledWith("user-123");
	});

	it("post-commit 이벤트 발행 관측이 끝난 뒤 캐시를 무효화한다", async () => {
		// Given - 이벤트 publisher 완료를 외부 gate로 지연
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		let release: (() => void) | undefined;
		const publication = new Promise<void>((resolve) => {
			release = resolve;
		});
		eventPublisher.publishAll.mockReturnValue(publication);

		// When - 삭제 실행
		const execution = useCase.execute({ id: 1, userId: "user-123" });
		await new Promise((resolve) => setImmediate(resolve));

		// Then - publisher 완료 전에는 후속 캐시 작업으로 진행하지 않음
		expect(todoCache.invalidateTodoCategories).not.toHaveBeenCalled();
		release?.();
		await execution;
		expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던지고 삭제하지 않는다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({ id: 999, userId: "user-123" }),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.delete).not.toHaveBeenCalled();
		expect(todoCache.invalidateTodoCategories).not.toHaveBeenCalled();
		expect(todoCache.invalidateFriendTodos).not.toHaveBeenCalled();
	});

	it("다른 사용자의 할 일이면 조회되지 않아 TODO_0801을 던진다 (사용자 격리)", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({ id: 1, userId: "other-user" }),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
	});
});
