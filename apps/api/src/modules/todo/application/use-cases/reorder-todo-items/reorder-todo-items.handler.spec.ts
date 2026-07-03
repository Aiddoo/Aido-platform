/**
 * ReorderTodoItemsHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 * 오라클: 레거시 TodoService.reorderItems 집합 검증 분기 재현
 */

import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
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
import { ReorderTodoItemsCommand } from "./reorder-todo-items.command";
import { ReorderTodoItemsHandler } from "./reorder-todo-items.handler";

function buildItem(id: number): TodoItemSnapshot {
	return {
		id,
		title: `항목 ${id}`,
		completed: false,
		sortOrder: id - 1,
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
	};
}

function buildEntity(items: TodoItemSnapshot[]): Todo {
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

describe("ReorderTodoItemsHandler — 하위 항목 순서 변경 핸들러", () => {
	let handler: ReorderTodoItemsHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ReorderTodoItemsHandler)
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

	it("전체 항목 ID를 새 순서로 전달하면 일괄 재정렬한다", async () => {
		// Given - 항목 3개 보유
		todoRepository.findByIdAndUserId.mockResolvedValue(
			buildEntity([buildItem(1), buildItem(2), buildItem(3)]),
		);
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When - 항목 3을 맨 앞으로
		const result = await handler.execute(
			new ReorderTodoItemsCommand(1, "user-123", [3, 1, 2]),
		);

		// Then
		expect(todoRepository.reorderItems).toHaveBeenCalledWith(
			[3, 1, 2],
			expect.anything(),
		);
		expect(result.id).toBe(1);
	});

	it("일부 ID만 전달하면 ApplicationException(SYS_0002)을 던진다", async () => {
		// Given - 항목 3개인데 2개만 전달
		todoRepository.findByIdAndUserId.mockResolvedValue(
			buildEntity([buildItem(1), buildItem(2), buildItem(3)]),
		);

		// When & Then
		await expect(
			handler.execute(new ReorderTodoItemsCommand(1, "user-123", [3, 1])),
		).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
		expect(todoRepository.reorderItems).not.toHaveBeenCalled();
	});

	it("다른 투두의 항목 ID가 섞이면 ApplicationException(TODO_0822)을 던진다", async () => {
		// Given - 항목 [1,2] 보유인데 999 포함
		todoRepository.findByIdAndUserId.mockResolvedValue(
			buildEntity([buildItem(1), buildItem(2)]),
		);

		// When & Then
		await expect(
			handler.execute(new ReorderTodoItemsCommand(1, "user-123", [999, 1])),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0822 });
		expect(todoRepository.reorderItems).not.toHaveBeenCalled();
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			handler.execute(new ReorderTodoItemsCommand(999, "user-123", [1])),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
	});
});
