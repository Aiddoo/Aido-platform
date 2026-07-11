/**
 * TodoDeletedHandler 단위 테스트
 *
 * Suites + GWT 패턴
 */

import { TestBed } from "@suites/unit";
import { TodoDeletedEvent } from "../../domain/events/todo-deleted.event";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "../ports/todo-reminder.port";
import { TodoDeletedHandler } from "./todo-deleted.handler";

describe("TodoDeletedHandler — 삭제 이벤트 핸들러", () => {
	let handler: TodoDeletedHandler;
	let todoReminder: TodoReminderPort;

	beforeEach(async () => {
		todoReminder = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn(),
		};

		const { unit } = await TestBed.solitary(TodoDeletedHandler)
			.mock(TODO_REMINDER)
			.impl(() => todoReminder)
			.compile();

		handler = unit;
	});

	it("삭제된 할 일의 리마인더를 취소한다", () => {
		// Given & When
		handler.handle(new TodoDeletedEvent(1, "user-123"));

		// Then
		expect(todoReminder.cancelReminder).toHaveBeenCalledWith(1);
	});

	it("리마인더 포트가 던져도 예외를 전파하지 않는다 (fire-and-forget)", () => {
		// Given - 리마인더 취소 실패
		jest.mocked(todoReminder.cancelReminder).mockImplementation(() => {
			throw new Error("scheduler down");
		});

		// When & Then - 삼켜진다
		expect(() =>
			handler.handle(new TodoDeletedEvent(1, "user-123")),
		).not.toThrow();
	});
});
