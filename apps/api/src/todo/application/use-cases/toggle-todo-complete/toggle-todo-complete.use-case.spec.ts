/**
 * ToggleTodoCompleteUseCase 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 */

import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import {
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
import { Todo } from "../../../domain/entities/todo.aggregate";
import { TodoToggledEvent } from "../../../domain/events/todo-toggled.event";
import { TodoId } from "../../../domain/value-objects/todo-id.vo";
import { TodoSchedule } from "../../../domain/value-objects/todo-schedule.vo";
import { TodoMapper } from "../../../infrastructure/persistence/todo-response.mapper";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { ToggleTodoCompleteUseCase } from "./toggle-todo-complete.use-case";

function buildEntity(completed = false): Todo {
	return Todo.reconstitute({
		id: TodoId.create(1),
		userId: "user-123",
		title: "할 일",
		categoryId: 1,
		sortOrder: 0,
		completed,
		completedAt: completed ? new Date() : null,
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

function buildResponse(completed: boolean): TodoResponse {
	const builder = TodoBuilder.create("user-123").withId(1);
	return TodoMapper.toResponse(
		(completed ? builder.completed() : builder.uncompleted()).build(),
	);
}

describe("ToggleTodoCompleteUseCase — 완료 토글 핸들러", () => {
	let useCase: ToggleTodoCompleteUseCase;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let todoCache: Mocked<TodoCachePort>;
	let eventPublisher: Mocked<DomainEventPublisherPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ToggleTodoCompleteUseCase)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.mock<TodoCachePort>(TODO_CACHE)
			.impl(() => createTodoCacheMock())
			.mock<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER)
			.impl(() => ({ publishAll: jest.fn().mockResolvedValue(undefined) }))
			.compile();

		useCase = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		todoCache = unitRef.get<TodoCachePort>(TODO_CACHE);
		eventPublisher = unitRef.get<DomainEventPublisherPort>(
			DOMAIN_EVENT_PUBLISHER,
		);
	});

	it("대상 할 일이 없으면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given - 존재하지 않는 할 일
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({
				id: 999,
				userId: "user-123",
				completed: true,
				timezone: "UTC",
			}),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.updateCompletion).not.toHaveBeenCalled();
	});

	it("완료로 토글하면 completed/completedAt을 저장하고 응답을 반환한다", async () => {
		// Given - 미완료 할 일
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(false));
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse(true));

		// When - 완료로 토글하면
		const result = await useCase.execute({
			id: 1,
			userId: "user-123",
			completed: true,
			timezone: "Asia/Seoul",
		});

		// Then - completed=true, completedAt(Date)로 저장을 위임하고 이벤트를 발행한다
		expect(todoRepository.updateCompletion).toHaveBeenCalledWith(
			1,
			true,
			expect.any(Date),
		);
		expect(eventPublisher.publishAll).toHaveBeenCalledWith([
			new TodoToggledEvent(1, "user-123", true, "Asia/Seoul"),
		]);
		expect(todoCache.invalidateFriendTodos).toHaveBeenCalledWith("user-123");
		expect(result.completed).toBe(true);
	});

	it("post-commit 이벤트 발행 관측이 끝난 뒤 응답을 재조회한다", async () => {
		// Given - 이벤트 publisher 완료를 외부 gate로 지연
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(false));
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse(true));
		let release: (() => void) | undefined;
		const publication = new Promise<void>((resolve) => {
			release = resolve;
		});
		eventPublisher.publishAll.mockReturnValue(publication);

		// When - 완료 토글 실행
		const execution = useCase.execute({
			id: 1,
			userId: "user-123",
			completed: true,
			timezone: "UTC",
		});
		await new Promise((resolve) => setImmediate(resolve));

		// Then - publisher 완료 전에는 post-commit 재조회로 진행하지 않음
		expect(todoReadRepository.findByIdAndUserId).not.toHaveBeenCalled();
		release?.();
		await execution;
		expect(todoReadRepository.findByIdAndUserId).toHaveBeenCalled();
	});

	it("같은 값으로 재토글하면 쓰기·이벤트 없이 현재 응답을 그대로 반환한다 (스트릭/알림 재발화 억제)", async () => {
		// Given - 이미 완료된 할 일에 completed=true 재요청
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(true));
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse(true));

		// When
		const result = await useCase.execute({
			id: 1,
			userId: "user-123",
			completed: true,
			timezone: "UTC",
		});

		// Then - 영속화 생략 + 빈 이벤트 배열 발행(부수효과 없음), 응답 계약(200)은 유지
		expect(todoRepository.updateCompletion).not.toHaveBeenCalled();
		expect(eventPublisher.publishAll).toHaveBeenCalledWith([]);
		expect(result.completed).toBe(true);
	});
});
