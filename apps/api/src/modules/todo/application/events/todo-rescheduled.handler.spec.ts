/**
 * TodoRescheduledHandler 단위 테스트
 *
 * Suites + GWT 패턴 — scheduledTime 유무에 따른 재스케줄/취소 분기 검증
 */

import { TestBed } from "@suites/unit";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../../../scheduler/reminder";
import { TodoRescheduledEvent } from "../../domain/events/todo-rescheduled.event";
import { TodoRescheduledHandler } from "./todo-rescheduled.handler";

describe("TodoRescheduledHandler — 일정 변경 이벤트 핸들러", () => {
	let handler: TodoRescheduledHandler;
	let reminderScheduler: IReminderScheduler;

	beforeEach(async () => {
		reminderScheduler = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn(),
		};

		const { unit } = await TestBed.solitary(TodoRescheduledHandler)
			.mock(REMINDER_SCHEDULER)
			.impl(() => reminderScheduler)
			.compile();

		handler = unit;
	});

	it("scheduledTime이 있으면 리마인더를 재스케줄한다", () => {
		// Given
		const scheduledTime = new Date("2026-03-01T06:00:00.000Z");

		// When
		handler.handle(new TodoRescheduledEvent(1, "user-123", scheduledTime));

		// Then
		expect(reminderScheduler.scheduleReminder).toHaveBeenCalledWith(
			1,
			scheduledTime,
			"user-123",
		);
		expect(reminderScheduler.cancelReminder).not.toHaveBeenCalled();
	});

	it("scheduledTime이 null이면 리마인더를 취소한다", () => {
		// Given & When
		handler.handle(new TodoRescheduledEvent(1, "user-123", null));

		// Then
		expect(reminderScheduler.cancelReminder).toHaveBeenCalledWith(1);
		expect(reminderScheduler.scheduleReminder).not.toHaveBeenCalled();
	});

	it("스케줄러가 던져도 예외를 전파하지 않는다 (fire-and-forget)", () => {
		// Given - 스케줄러 실패
		jest.mocked(reminderScheduler.scheduleReminder).mockImplementation(() => {
			throw new Error("scheduler down");
		});

		// When & Then - 삼켜진다
		expect(() =>
			handler.handle(new TodoRescheduledEvent(1, "user-123", new Date())),
		).not.toThrow();
	});
});
