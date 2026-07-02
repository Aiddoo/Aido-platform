/**
 * ToggleTodoCompleteHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 */

import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { EventPublisher } from "@nestjs/cqrs";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import {
	createTodoReadRepositoryMock,
	createTodoRepositoryMock,
} from "@test/mocks/ports";
import { ApplicationException } from "@/common/domain";
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
import { ToggleTodoCompleteCommand } from "./toggle-todo-complete.command";
import { ToggleTodoCompleteHandler } from "./toggle-todo-complete.handler";

function buildEntity(completed = false): Todo {
	return Todo.reconstitute({
		id: TodoId.create(1),
		userId: "user-123",
		title: "할 일",
		categoryId: 1,
		sortOrder: 0,
		completed,
		completedAt: completed ? new Date() : null,
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

function buildResponse(completed: boolean): TodoResponse {
	const builder = TodoBuilder.create("user-123").withId(1);
	return TodoMapper.toResponse(
		(completed ? builder.completed() : builder.uncompleted()).build(),
	);
}

describe("ToggleTodoCompleteHandler — 완료 토글 핸들러", () => {
	let handler: ToggleTodoCompleteHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let eventPublisher: Mocked<EventPublisher>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ToggleTodoCompleteHandler)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.compile();

		handler = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		eventPublisher = unitRef.get(EventPublisher);
		// mergeObjectContext는 전달된 애그리게잇을 그대로 반환하도록 설정
		eventPublisher.mergeObjectContext.mockImplementation(
			(aggregate) => aggregate,
		);
	});

	it("대상 할 일이 없으면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given - 존재하지 않는 할 일
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			handler.execute(
				new ToggleTodoCompleteCommand(999, "user-123", true, "UTC"),
			),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.updateCompletion).not.toHaveBeenCalled();
	});

	it("완료로 토글하면 completed/completedAt을 저장하고 응답을 반환한다", async () => {
		// Given - 미완료 할 일
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(false));
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse(true));

		// When - 완료로 토글하면
		const result = await handler.execute(
			new ToggleTodoCompleteCommand(1, "user-123", true, "Asia/Seoul"),
		);

		// Then - completed=true, completedAt(Date)로 저장을 위임하고 응답을 반환한다
		expect(todoRepository.updateCompletion).toHaveBeenCalledWith(
			1,
			true,
			expect.any(Date),
		);
		expect(result.completed).toBe(true);
	});

	it("throws로 실패해도 ApplicationException 인스턴스여야 한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			handler.execute(
				new ToggleTodoCompleteCommand(1, "user-123", true, "UTC"),
			),
		).rejects.toBeInstanceOf(ApplicationException);
	});
});
