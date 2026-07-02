/**
 * ToggleTodoCompleteHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 */

import { ErrorCode } from "@aido/errors";
import { EventPublisher } from "@nestjs/cqrs";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createTodoRepositoryMock } from "@test/mocks/ports";
import { ApplicationException } from "@/common/domain";
import { Todo } from "../../../domain/entities/todo.entity";
import type { TodoRepositoryPort } from "../../ports/todo.repository.port";
import { TODO_REPOSITORY } from "../../ports/todo.repository.port";
import { ToggleTodoCompleteCommand } from "./toggle-todo-complete.command";
import { ToggleTodoCompleteHandler } from "./toggle-todo-complete.handler";

function buildEntity(completed = false): Todo {
	return Todo.reconstitute({
		id: 1,
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
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
		category: { id: 1, name: "일반", color: "#FFFFFF", sortOrder: 0 },
		items: [],
	});
}

describe("ToggleTodoCompleteHandler — 완료 토글 핸들러", () => {
	let handler: ToggleTodoCompleteHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let eventPublisher: Mocked<EventPublisher>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ToggleTodoCompleteHandler)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.compile();

		handler = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		eventPublisher = unitRef.get(EventPublisher);
		// mergeObjectContext는 전달된 애그리게잇을 그대로 반환하도록 설정
		(eventPublisher.mergeObjectContext as jest.Mock).mockImplementation(
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
		expect(todoRepository.update).not.toHaveBeenCalled();
	});

	it("완료로 토글하면 completed/completedAt을 저장하고 결과를 반환한다", async () => {
		// Given - 미완료 할 일
		const entity = buildEntity(false);
		todoRepository.findByIdAndUserId.mockResolvedValue(entity);
		todoRepository.update.mockResolvedValue(buildEntity(true));

		// When - 완료로 토글하면
		const result = await handler.execute(
			new ToggleTodoCompleteCommand(1, "user-123", true, "Asia/Seoul"),
		);

		// Then - completed=true, completedAt(Date)로 업데이트를 위임한다
		expect(todoRepository.update).toHaveBeenCalledWith(1, {
			completed: true,
			completedAt: expect.any(Date),
		});
		expect(result.isCompleted()).toBe(true);
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
