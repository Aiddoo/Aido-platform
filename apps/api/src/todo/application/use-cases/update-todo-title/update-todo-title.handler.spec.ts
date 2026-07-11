/**
 * UpdateTodoTitleHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 */

import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import {
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
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { UpdateTodoTitleCommand } from "./update-todo-title.command";
import { UpdateTodoTitleHandler } from "./update-todo-title.handler";

function buildEntity(): Todo {
	return Todo.reconstitute({
		id: TodoId.create(1),
		userId: "user-123",
		title: "이전 제목",
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

function buildResponse(): TodoResponse {
	return TodoMapper.toResponse(
		TodoBuilder.create("user-123").withId(1).withTitle("새 제목").build(),
	);
}

describe("UpdateTodoTitleHandler — 할 일 제목 수정 핸들러", () => {
	let handler: UpdateTodoTitleHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let eventPublisher: Mocked<DomainEventPublisherPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(UpdateTodoTitleHandler)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.mock<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER)
			.impl(() => ({ publishAll: jest.fn() }))
			.compile();

		handler = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		eventPublisher = unitRef.get<DomainEventPublisherPort>(
			DOMAIN_EVENT_PUBLISHER,
		);
	});

	it("애그리게잇 상태로 제목을 영속화하고 TodoUpdatedEvent를 발행한 뒤 응답을 재조회한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await handler.execute(
			new UpdateTodoTitleCommand(1, "user-123", "새 제목"),
		);

		// Then - 영속화 + 이벤트(전이 후 완료 상태 사실 → completed=false)
		expect(todoRepository.updateTitle).toHaveBeenCalledWith(1, "새 제목");
		expect(eventPublisher.publishAll).toHaveBeenCalledWith([
			new TodoUpdatedEvent(1, "user-123", false),
		]);
		expect(result.title).toBe("새 제목");
	});

	it("제목이 200자를 초과하면 DomainException(SYS_0002)을 던지고 영속화하지 않는다 (도메인 자기방어)", async () => {
		// Given - 201자 제목 (Zod 통과를 우회한 비정상 입력 가정)
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());

		// When & Then
		await expect(
			handler.execute(
				new UpdateTodoTitleCommand(1, "user-123", "가".repeat(201)),
			),
		).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
		expect(todoRepository.updateTitle).not.toHaveBeenCalled();
		expect(eventPublisher.publishAll).not.toHaveBeenCalled();
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			handler.execute(new UpdateTodoTitleCommand(999, "user-123", "제목")),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.updateTitle).not.toHaveBeenCalled();
	});

	it("다른 사용자의 할 일이면 조회되지 않아 TODO_0801을 던진다 (사용자 격리)", async () => {
		// Given - 소유권 불일치는 findByIdAndUserId가 null 반환으로 표현
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			handler.execute(new UpdateTodoTitleCommand(1, "other-user", "제목")),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
	});
});
