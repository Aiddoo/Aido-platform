/**
 * ReorderTodoHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 * 오라클: 레거시 TodoService.reorder 분기(상대 이동·엣지 이동·자기 자신·타깃 없음) 재현
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
import { Todo } from "../../../domain/entities/todo.entity";
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
import { ReorderTodoCommand } from "./reorder-todo.command";
import { ReorderTodoHandler } from "./reorder-todo.handler";

function buildEntity(id: number, sortOrder: number): Todo {
	return Todo.reconstitute({
		id: TodoId.create(id),
		userId: "user-123",
		title: `할 일 ${id}`,
		categoryId: 1,
		sortOrder,
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
		TodoBuilder.create("user-123").withId(1).build(),
	);
}

describe("ReorderTodoHandler — 할 일 순서 변경 핸들러", () => {
	let handler: ReorderTodoHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ReorderTodoHandler)
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

	it("아래 방향 상대 이동(before): 사이 구간을 -1 시프트하고 보정된 위치로 이동한다", async () => {
		// Given - sortOrder 0의 할 일을 sortOrder 3 앞으로
		todoRepository.findByIdAndUserId
			.mockResolvedValueOnce(buildEntity(1, 0)) // 이동 대상
			.mockResolvedValueOnce(buildEntity(5, 3)); // 기준 할 일
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await handler.execute(new ReorderTodoCommand(1, "user-123", 5, "before"));

		// Then - [1, 2] 구간 -1, 보정 위치 2
		expect(todoRepository.shiftSortOrders).toHaveBeenCalledWith(
			"user-123",
			1,
			2,
			-1,
			expect.anything(),
		);
		expect(todoRepository.updateSortOrder).toHaveBeenCalledWith(
			1,
			2,
			expect.anything(),
		);
	});

	it("위 방향 상대 이동(before): 사이 구간을 +1 시프트한다", async () => {
		// Given - sortOrder 5의 할 일을 sortOrder 2 앞으로
		todoRepository.findByIdAndUserId
			.mockResolvedValueOnce(buildEntity(1, 5))
			.mockResolvedValueOnce(buildEntity(3, 2));
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await handler.execute(new ReorderTodoCommand(1, "user-123", 3, "before"));

		// Then - [2, 4] 구간 +1, 새 위치 2
		expect(todoRepository.shiftSortOrders).toHaveBeenCalledWith(
			"user-123",
			2,
			4,
			1,
			expect.anything(),
		);
		expect(todoRepository.updateSortOrder).toHaveBeenCalledWith(
			1,
			2,
			expect.anything(),
		);
	});

	it("targetTodoId 없이 before면 맨 앞(0)으로 이동한다", async () => {
		// Given - sortOrder 4의 할 일
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(1, 4));
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await handler.execute(
			new ReorderTodoCommand(1, "user-123", undefined, "before"),
		);

		// Then - [0, 3] 구간 +1, 새 위치 0
		expect(todoRepository.shiftSortOrders).toHaveBeenCalledWith(
			"user-123",
			0,
			3,
			1,
			expect.anything(),
		);
		expect(todoRepository.updateSortOrder).toHaveBeenCalledWith(
			1,
			0,
			expect.anything(),
		);
	});

	it("targetTodoId 없이 after면 맨 뒤(maxSortOrder)로 이동한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(1, 2));
		todoRepository.getMaxSortOrder.mockResolvedValue(7);
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await handler.execute(
			new ReorderTodoCommand(1, "user-123", undefined, "after"),
		);

		// Then - [3, null] 구간 -1, 새 위치 7
		expect(todoRepository.shiftSortOrders).toHaveBeenCalledWith(
			"user-123",
			3,
			null,
			-1,
			expect.anything(),
		);
		expect(todoRepository.updateSortOrder).toHaveBeenCalledWith(
			1,
			7,
			expect.anything(),
		);
	});

	it("자기 자신을 기준으로 지정하면 쓰기 없이 현재 상태를 반환한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(1, 0));
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await handler.execute(
			new ReorderTodoCommand(1, "user-123", 1, "before"),
		);

		// Then
		expect(todoRepository.shiftSortOrders).not.toHaveBeenCalled();
		expect(todoRepository.updateSortOrder).not.toHaveBeenCalled();
		expect(result.id).toBe(1);
	});

	it("기준 할 일이 없으면 ApplicationException(TODO_0810)을 던진다", async () => {
		// Given - 기준 할 일 조회 실패
		todoRepository.findByIdAndUserId
			.mockResolvedValueOnce(buildEntity(1, 0))
			.mockResolvedValueOnce(null);

		// When & Then
		await expect(
			handler.execute(new ReorderTodoCommand(1, "user-123", 999, "before")),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0810 });
		expect(todoRepository.updateSortOrder).not.toHaveBeenCalled();
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			handler.execute(new ReorderTodoCommand(999, "user-123", 1, "before")),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
	});
});
