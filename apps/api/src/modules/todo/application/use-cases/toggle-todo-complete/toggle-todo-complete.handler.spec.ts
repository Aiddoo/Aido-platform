/**
 * ToggleTodoCompleteHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 */

import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { EventBus } from "@nestjs/cqrs";
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
import { TodoToggledEvent } from "../../../domain/events/todo-toggled.event";
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

describe("ToggleTodoCompleteHandler — 완료 토글 핸들러", () => {
	let handler: ToggleTodoCompleteHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let eventBus: Mocked<EventBus>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ToggleTodoCompleteHandler)
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
		eventBus = unitRef.get(EventBus);
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

		// Then - completed=true, completedAt(Date)로 저장을 위임하고 이벤트를 발행한다
		expect(todoRepository.updateCompletion).toHaveBeenCalledWith(
			1,
			true,
			expect.any(Date),
			expect.anything(),
		);
		expect(eventBus.publishAll).toHaveBeenCalledWith([
			new TodoToggledEvent(1, "user-123", true, "Asia/Seoul"),
		]);
		expect(result.completed).toBe(true);
	});

	it("같은 값으로 재토글하면 쓰기·이벤트 없이 현재 응답을 그대로 반환한다 (스트릭/알림 재발화 억제)", async () => {
		// Given - 이미 완료된 할 일에 completed=true 재요청
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(true));
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse(true));

		// When
		const result = await handler.execute(
			new ToggleTodoCompleteCommand(1, "user-123", true, "UTC"),
		);

		// Then - 영속화 생략 + 빈 이벤트 배열 발행(부수효과 없음), 응답 계약(200)은 유지
		expect(todoRepository.updateCompletion).not.toHaveBeenCalled();
		expect(eventBus.publishAll).toHaveBeenCalledWith([]);
		expect(result.completed).toBe(true);
	});
});
