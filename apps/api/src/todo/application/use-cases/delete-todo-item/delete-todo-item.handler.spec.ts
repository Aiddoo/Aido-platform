/**
 * DeleteTodoItemHandler 단위 테스트
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
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { Todo } from "../../../domain/entities/todo.entity";
import { TodoItem } from "../../../domain/entities/todo-item.entity";
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
import { DeleteTodoItemCommand } from "./delete-todo-item.command";
import { DeleteTodoItemHandler } from "./delete-todo-item.handler";

function buildItem(id: number): TodoItem {
	return TodoItem.reconstitute({
		id,
		title: `항목 ${id}`,
		completed: false,
		sortOrder: id - 1,
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
	});
}

function buildEntity(items: TodoItem[]): Todo {
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
		items,
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
	});
}

function buildResponse(): TodoResponse {
	return TodoMapper.toResponse(
		TodoBuilder.create("user-123").withId(1).build(),
	);
}

describe("DeleteTodoItemHandler — 하위 항목 삭제 핸들러", () => {
	let handler: DeleteTodoItemHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(DeleteTodoItemHandler)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();

		handler = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
	});

	it("항목을 삭제하고 부모를 재조회한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(
			buildEntity([buildItem(10)]),
		);
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await handler.execute(
			new DeleteTodoItemCommand(1, 10, "user-123"),
		);

		// Then
		expect(todoRepository.deleteItem).toHaveBeenCalledWith(10);
		expect(result.id).toBe(1);
	});

	it("항목이 부모에 없으면 ApplicationException(TODO_0822)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(
			buildEntity([buildItem(10)]),
		);

		// When & Then
		await expect(
			handler.execute(new DeleteTodoItemCommand(1, 999, "user-123")),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0822 });
		expect(todoRepository.deleteItem).not.toHaveBeenCalled();
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			handler.execute(new DeleteTodoItemCommand(999, 1, "user-123")),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
	});
});
