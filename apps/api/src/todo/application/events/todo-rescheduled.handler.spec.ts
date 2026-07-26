/**
 * TodoRescheduledHandler 단위 테스트
 *
 * Suites + GWT 패턴 — scheduledTime 유무에 따른 재스케줄/취소 분기 검증
 */

import { TestBed } from "@suites/unit";
import { TodoRescheduledEvent } from "../../domain/events/todo-rescheduled.event";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "../ports/todo-reminder.port";
import { TodoRescheduledHandler } from "./todo-rescheduled.handler";

describe("TodoRescheduledHandler — 일정 변경 이벤트 핸들러", () => {
	let handler: TodoRescheduledHandler;
	let todoReminder: TodoReminderPort;

	beforeEach(async () => {
		todoReminder = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn().mockResolvedValue({ status: "cancelled" }),
		};

		const { unit } = await TestBed.solitary(TodoRescheduledHandler)
			.mock(TODO_REMINDER)
			.impl(() => todoReminder)
			.compile();

		handler = unit;
	});

	it("scheduledTime이 있으면 리마인더를 재스케줄한다", async () => {
		// Given
		const scheduledTime = new Date("2026-03-01T06:00:00.000Z");

		// When
		await handler.handle(
			new TodoRescheduledEvent(1, "user-123", scheduledTime),
		);

		// Then
		expect(todoReminder.scheduleReminder).toHaveBeenCalledWith(
			1,
			scheduledTime,
			"user-123",
		);
		expect(todoReminder.cancelReminder).not.toHaveBeenCalled();
	});

	it("scheduledTime이 null이면 리마인더를 취소한다", async () => {
		// Given & When
		await handler.handle(new TodoRescheduledEvent(1, "user-123", null));

		// Then
		expect(todoReminder.cancelReminder).toHaveBeenCalledWith(1);
		expect(todoReminder.scheduleReminder).not.toHaveBeenCalled();
	});

	it("취소할 작업이 이미 없으면 missing을 정상 처리한다", async () => {
		// Given - 잡이 이미 처리됨
		jest.mocked(todoReminder.cancelReminder).mockResolvedValue({
			status: "missing",
		});

		// When & Then - 명시적 missing만 정상 처리
		await expect(
			handler.handle(new TodoRescheduledEvent(1, "user-123", null)),
		).resolves.toBeUndefined();
	});

	it("리마인더 취소 인프라 실패를 전파한다", async () => {
		// Given - 리마인더 취소 실패
		const error = new Error("scheduler down");
		const rejected = Promise.reject(error);
		void rejected.catch(() => undefined);
		jest.mocked(todoReminder.cancelReminder).mockReturnValue(rejected);

		// When & Then - 성공/missing으로 삼키지 않음
		await expect(
			handler.handle(new TodoRescheduledEvent(1, "user-123", null)),
		).rejects.toBe(error);
	});
});
