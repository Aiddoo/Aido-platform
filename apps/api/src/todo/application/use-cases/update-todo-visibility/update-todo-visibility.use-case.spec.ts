/**
 * UpdateTodoVisibilityUseCase 단위 테스트
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
import { UpdateTodoVisibilityUseCase } from "./update-todo-visibility.use-case";

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

function buildResponse(): TodoResponse {
	return TodoMapper.toResponse(
		TodoBuilder.create("user-123").withId(1).build(),
	);
}

describe("UpdateTodoVisibilityUseCase — 할 일 공개 범위 변경 핸들러", () => {
	let useCase: UpdateTodoVisibilityUseCase;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			UpdateTodoVisibilityUseCase,
		)
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

	it("공개 범위를 영속화하고 응답을 재조회한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await useCase.execute({
			id: 1,
			userId: "user-123",
			visibility: "PRIVATE",
		});

		// Then
		expect(todoRepository.updateVisibility).toHaveBeenCalledWith(1, "PRIVATE");
		expect(result.id).toBe(1);
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({ id: 999, userId: "user-123", visibility: "PUBLIC" }),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.updateVisibility).not.toHaveBeenCalled();
	});

	it("재조회 응답이 없으면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given - 영속화는 성공했지만 재조회가 비어 있는 비정상 상태
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({ id: 1, userId: "user-123", visibility: "PRIVATE" }),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
	});
});
