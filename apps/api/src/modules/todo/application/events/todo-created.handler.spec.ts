/**
 * TodoCreatedHandler 단위 테스트
 *
 * Suites + GWT 패턴 — scheduledTime 유무에 따른 리마인더 스케줄 분기 검증
 */

import { TestBed } from "@suites/unit";
import { TodoCreatedEvent } from "../../domain/events/todo-created.event";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "../ports/todo-reminder.port";
import { TodoCreatedHandler } from "./todo-created.handler";

describe("TodoCreatedHandler — 생성 이벤트 핸들러", () => {
	let handler: TodoCreatedHandler;
	let todoReminder: TodoReminderPort;

	beforeEach(async () => {
		todoReminder = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn(),
		};

		const { unit } = await TestBed.solitary(TodoCreatedHandler)
			.mock(TODO_REMINDER)
			.impl(() => todoReminder)
			.compile();

		handler = unit;
	});

	it("scheduledTime이 있으면 리마인더를 스케줄한다", () => {
		// Given
		const scheduledTime = new Date("2026-03-01T06:00:00.000Z");

		// When
		handler.handle(new TodoCreatedEvent(1, "user-123", scheduledTime));

		// Then
		expect(todoReminder.scheduleReminder).toHaveBeenCalledWith(
			1,
			scheduledTime,
			"user-123",
		);
	});

	it("scheduledTime이 null이면 리마인더를 스케줄하지 않는다", () => {
		// Given & When
		handler.handle(new TodoCreatedEvent(1, "user-123", null));

		// Then
		expect(todoReminder.scheduleReminder).not.toHaveBeenCalled();
		expect(todoReminder.cancelReminder).not.toHaveBeenCalled();
	});

	it("스케줄러가 던져도 예외를 전파하지 않는다 (fire-and-forget)", () => {
		// Given - 스케줄러 실패
		jest.mocked(todoReminder.scheduleReminder).mockImplementation(() => {
			throw new Error("scheduler down");
		});

		// When & Then - 삼켜진다
		expect(() =>
			handler.handle(new TodoCreatedEvent(1, "user-123", new Date())),
		).not.toThrow();
	});
});
