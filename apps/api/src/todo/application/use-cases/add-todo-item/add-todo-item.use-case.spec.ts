/**
 * AddTodoItemUseCase 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 * 오라클: 레거시 TodoService.addItem 분기(한도·sortOrder·not-found) 재현
 * (한도·sortOrder 계획은 애그리게잇 planItemAddition이 소유)
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
	createUnitOfWorkMock,
} from "@test/mocks/ports";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { Todo } from "../../../domain/entities/todo.aggregate";
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
import { AddTodoItemUseCase } from "./add-todo-item.use-case";

function buildItem(id: number, sortOrder: number): TodoItem {
	return TodoItem.reconstitute({
		id,
		title: `항목 ${id}`,
		completed: false,
		sortOrder,
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
	});
}

function buildEntity(items: TodoItem[] = []): Todo {
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

describe("AddTodoItemUseCase — 하위 항목 추가 핸들러", () => {
	let useCase: AddTodoItemUseCase;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AddTodoItemUseCase)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();

		useCase = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
	});

	it("한도 여유가 있으면 맨 뒤 sortOrder로 항목을 생성하고 부모를 재조회한다", async () => {
		// Given - 항목 2개(sortOrder 0, 1) 보유
		todoRepository.findByIdAndUserId.mockResolvedValue(
			buildEntity([buildItem(10, 0), buildItem(11, 1)]),
		);
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await useCase.execute({
			todoId: 1,
			userId: "user-123",
			title: "항목C",
		});

		// Then - 애그리게잇 계획(max+1)대로 영속화
		expect(todoRepository.createItem).toHaveBeenCalledWith(1, {
			title: "항목C",
			sortOrder: 2,
		});
		expect(result.id).toBe(1);
	});

	it("항목 한도를 초과하면 DomainException(TODO_0821)을 던진다", async () => {
		// Given - 한도 도달 (애그리게잇이 보유 항목 수로 판단)
		const fullItems = Array.from(
			{ length: TODO_ITEM_LIMITS.MAX_PER_TODO },
			(_, index) => buildItem(index + 1, index),
		);
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(fullItems));

		// When & Then
		await expect(
			useCase.execute({ todoId: 1, userId: "user-123", title: "초과 항목" }),
		).rejects.toMatchObject({
			errorCode: ErrorCode.TODO_0821,
			details: {
				currentCount: TODO_ITEM_LIMITS.MAX_PER_TODO,
				maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
			},
		});
		expect(todoRepository.createItem).not.toHaveBeenCalled();
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({ todoId: 999, userId: "user-123", title: "항목" }),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.createItem).not.toHaveBeenCalled();
	});
});
