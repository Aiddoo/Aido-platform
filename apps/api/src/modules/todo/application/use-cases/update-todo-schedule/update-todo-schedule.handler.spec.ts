/**
 * UpdateTodoScheduleHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 * 오라클: 레거시 TodoService.updateSchedule 분기(리마인더 재스케줄/취소·null 처리) 재현
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
} from "@test/mocks/ports";
import { Todo } from "../../../domain/entities/todo.entity";
import { TodoRescheduledEvent } from "../../../domain/events/todo-rescheduled.event";
import { TodoId } from "../../../domain/value-objects/todo-id.vo";
import type { TodoScheduleProps } from "../../../domain/value-objects/todo-schedule.vo";
import { TodoMapper } from "../../../todo.mapper";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { UpdateTodoScheduleCommand } from "./update-todo-schedule.command";
import { UpdateTodoScheduleHandler } from "./update-todo-schedule.handler";

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

const timedSchedule: TodoScheduleProps = {
	startDate: new Date("2026-03-01"),
	endDate: null,
	scheduledTime: new Date("2026-03-01T06:00:00.000Z"),
	isAllDay: false,
};

const allDaySchedule: TodoScheduleProps = {
	startDate: new Date("2026-03-02"),
	endDate: new Date("2026-03-05"),
	scheduledTime: null,
	isAllDay: true,
};

describe("UpdateTodoScheduleHandler — 할 일 일정 변경 핸들러", () => {
	let handler: UpdateTodoScheduleHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let eventBus: Mocked<EventBus>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(UpdateTodoScheduleHandler)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.compile();

		handler = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		eventBus = unitRef.get(EventBus);
	});

	it("시간 일정으로 변경하면 영속화하고 scheduledTime을 담은 이벤트를 발행한다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await handler.execute(
			new UpdateTodoScheduleCommand(1, "user-123", timedSchedule),
		);

		// Then - 영속화 + 이벤트(리마인더 재스케줄은 이벤트 핸들러 몫)
		expect(todoRepository.updateSchedule).toHaveBeenCalledWith(
			1,
			timedSchedule,
		);
		expect(eventBus.publishAll).toHaveBeenCalledWith([
			new TodoRescheduledEvent(1, "user-123", timedSchedule.scheduledTime),
		]);
		expect(result.id).toBe(1);
	});

	it("종일 일정(scheduledTime=null)으로 변경하면 이벤트의 scheduledTime이 null이다 (리마인더 취소 트리거)", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await handler.execute(
			new UpdateTodoScheduleCommand(1, "user-123", allDaySchedule),
		);

		// Then
		expect(todoRepository.updateSchedule).toHaveBeenCalledWith(
			1,
			allDaySchedule,
		);
		expect(eventBus.publishAll).toHaveBeenCalledWith([
			new TodoRescheduledEvent(1, "user-123", null),
		]);
	});

	it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
		// Given
		todoRepository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			handler.execute(
				new UpdateTodoScheduleCommand(999, "user-123", allDaySchedule),
			),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.updateSchedule).not.toHaveBeenCalled();
	});

	it("역전된 날짜 범위면 DomainException으로 거부하고 영속화하지 않는다 (도메인 자기방어)", async () => {
		// Given - endDate < startDate (Zod 통과를 우회한 비정상 입력 가정)
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());

		// When & Then
		await expect(
			handler.execute(
				new UpdateTodoScheduleCommand(1, "user-123", {
					startDate: new Date("2026-03-05"),
					endDate: new Date("2026-03-01"),
					scheduledTime: null,
					isAllDay: true,
				}),
			),
		).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
		expect(todoRepository.updateSchedule).not.toHaveBeenCalled();
	});
});
