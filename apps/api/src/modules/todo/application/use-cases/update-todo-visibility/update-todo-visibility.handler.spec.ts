/**
 * UpdateTodoVisibilityHandler 단위 테스트
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
} from "@test/mocks/ports";
import { Todo } from "../../../domain/entities/todo.entity";
import { TodoId } from "../../../domain/value-objects/todo-id.vo";
import { TodoMapper } from "../../../todo.mapper";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { UpdateTodoVisibilityCommand } from "./update-todo-visibility.command";
import { UpdateTodoVisibilityHandler } from "./update-todo-visibility.handler";

function buildEntity(): Todo {
	return Todo.reconstitute({
		id: TodoId.create(1),
		userId: "user-123",
		title: "할 일",
		categoryId: 1,
		sortOrder: 0,
		completed: false,
		completedAt: null,
		startDate: new Date("2026-02-22"),
		endDate: null,
		scheduledTime: null,
		isAllDay: true,
		visibility: "PUBLIC",
		recurrenceGroupId: null,
		items: [],
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
	});
}

function buildResponse(): TodoResponse {
	return TodoMapper.toResponse(
		TodoBuilder.create("user-123").withId(1).build(),
	);
}

describe("UpdateTodoVisibilityHandler — 할 일 공개 범위 변경 핸들러", () => {
	let handler: UpdateTodoVisibilityHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			UpdateTodoVisibilityHandler,
		)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.compile();

		handler = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
	});

	it("공개 범위를 영속화하고 응답을 재조회한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await handler.execute(
			new UpdateTodoVisibilityCommand(1, "user-123", "PRIVATE"),
		);

		// Then
		expect(todoRepository.updateVisibility).toHaveBeenCalledWith(1, "PRIVATE");
		expect(result.id).toBe(1);
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			handler.execute(
				new UpdateTodoVisibilityCommand(999, "user-123", "PUBLIC"),
			),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.updateVisibility).not.toHaveBeenCalled();
	});
});
