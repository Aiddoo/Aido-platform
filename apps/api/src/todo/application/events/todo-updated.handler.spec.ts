/**
 * TodoUpdatedHandler 단위 테스트
 *
 * Suites + GWT 패턴 — 완료 요청 여부에 따른 리마인더 취소 분기 검증
 */

import { TestBed } from "@suites/unit";
import { TodoUpdatedEvent } from "../../domain/events/todo-updated.event";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "../ports/todo-reminder.port";
import { TodoUpdatedHandler } from "./todo-updated.handler";

describe("TodoUpdatedHandler — 부분 수정 이벤트 핸들러", () => {
	let handler: TodoUpdatedHandler;
	let todoReminder: TodoReminderPort;

	beforeEach(async () => {
		todoReminder = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn(),
		};

		const { unit } = await TestBed.solitary(TodoUpdatedHandler)
			.mock(TODO_REMINDER)
			.impl(() => todoReminder)
			.compile();

		handler = unit;
	});

	it("완료 요청(completed=true)이면 리마인더를 취소한다", () => {
		// Given & When
		handler.handle(new TodoUpdatedEvent(1, "user-123", true));

		// Then
		expect(todoReminder.cancelReminder).toHaveBeenCalledWith(1);
	});

	it("미완료 요청(completed=false)이면 리마인더를 취소하지 않는다", () => {
		// Given & When
		handler.handle(new TodoUpdatedEvent(1, "user-123", false));

		// Then
		expect(todoReminder.cancelReminder).not.toHaveBeenCalled();
	});

	it("리마인더 포트가 던져도 예외를 전파하지 않는다 (fire-and-forget)", () => {
		// Given - 리마인더 취소 실패
		jest.mocked(todoReminder.cancelReminder).mockImplementation(() => {
			throw new Error("scheduler down");
		});

		// When & Then - 삼켜진다
		expect(() =>
			handler.handle(new TodoUpdatedEvent(1, "user-123", true)),
		).not.toThrow();
	});
});
