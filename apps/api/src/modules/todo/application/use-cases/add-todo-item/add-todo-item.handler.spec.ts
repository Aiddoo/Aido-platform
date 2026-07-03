/**
 * AddTodoItemHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 * 오라클: 레거시 TodoService.addItem 분기(한도·sortOrder·not-found) 재현
 */

import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { TODO_ITEM_LIMITS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import {
	createTodoReadRepositoryMock,
	createTodoRepositoryMock,
	createTransactionManagerMock,
} from "@test/mocks/ports";
import { TRANSACTION_MANAGER } from "@/common/database";
import {
	Todo,
	type TodoItemSnapshot,
} from "../../../domain/entities/todo.entity";
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
import { AddTodoItemCommand } from "./add-todo-item.command";
import { AddTodoItemHandler } from "./add-todo-item.handler";

function buildEntity(items: TodoItemSnapshot[] = []): Todo {
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

describe("AddTodoItemHandler — 하위 항목 추가 핸들러", () => {
	let handler: AddTodoItemHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AddTodoItemHandler)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock(TRANSACTION_MANAGER)
			.impl(() => createTransactionManagerMock())
			.compile();

		handler = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
	});

	it("한도 여유가 있으면 맨 뒤 sortOrder로 항목을 생성하고 부모를 재조회한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoRepository.countItemsByTodoId.mockResolvedValue(2);
		todoRepository.getMaxItemSortOrder.mockResolvedValue(1);
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await handler.execute(
			new AddTodoItemCommand(1, "user-123", "항목C"),
		);

		// Then
		expect(todoRepository.createItem).toHaveBeenCalledWith(
			1,
			{ title: "항목C", sortOrder: 2 },
			expect.anything(),
		);
		expect(result.id).toBe(1);
	});

	it("항목 한도를 초과하면 ApplicationException(TODO_0821)을 던진다", async () => {
		// Given - 한도 도달
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoRepository.countItemsByTodoId.mockResolvedValue(
			TODO_ITEM_LIMITS.MAX_PER_TODO,
		);

		// When & Then
		await expect(
			handler.execute(new AddTodoItemCommand(1, "user-123", "초과 항목")),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0821 });
		expect(todoRepository.createItem).not.toHaveBeenCalled();
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			handler.execute(new AddTodoItemCommand(999, "user-123", "항목")),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.countItemsByTodoId).not.toHaveBeenCalled();
	});
});
