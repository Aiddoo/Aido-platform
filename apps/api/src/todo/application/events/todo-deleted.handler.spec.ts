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
			cancelReminder: jest.fn().mockResolvedValue({ status: "cancelled" }),
		};

		const { unit } = await TestBed.solitary(TodoDeletedHandler)
			.mock(TODO_REMINDER)
			.impl(() => todoReminder)
			.compile();

		handler = unit;
	});

	it("삭제된 할 일의 리마인더를 취소한다", async () => {
		// Given & When
		await handler.handle(new TodoDeletedEvent(1, "user-123"));

		// Then
		expect(todoReminder.cancelReminder).toHaveBeenCalledWith(1);
	});

	it("취소할 작업이 이미 없으면 missing을 정상 처리한다", async () => {
		// Given - 잡이 이미 처리됨
		jest.mocked(todoReminder.cancelReminder).mockResolvedValue({
			status: "missing",
		});

		// When & Then - 명시적 missing만 정상 처리
		await expect(
			handler.handle(new TodoDeletedEvent(1, "user-123")),
		).resolves.toBeUndefined();
	});

	it("리마인더 인프라 실패를 전파한다", async () => {
		// Given - 리마인더 취소 실패
		const error = new Error("scheduler down");
		const rejected = Promise.reject(error);
		void rejected.catch(() => undefined);
		jest.mocked(todoReminder.cancelReminder).mockReturnValue(rejected);

		// When & Then - 성공/missing으로 삼키지 않음
		await expect(
			handler.handle(new TodoDeletedEvent(1, "user-123")),
		).rejects.toBe(error);
	});
});
