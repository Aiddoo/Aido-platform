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
			cancelReminder: jest.fn().mockResolvedValue({ status: "cancelled" }),
		};

		const { unit } = await TestBed.solitary(TodoUpdatedHandler)
			.mock(TODO_REMINDER)
			.impl(() => todoReminder)
			.compile();

		handler = unit;
	});

	it("완료 요청(completed=true)이면 리마인더를 취소한다", async () => {
		// Given & When
		await handler.handle(new TodoUpdatedEvent(1, "user-123", true));

		// Then
		expect(todoReminder.cancelReminder).toHaveBeenCalledWith(1);
	});

	it("미완료 요청(completed=false)이면 리마인더를 취소하지 않는다", async () => {
		// Given & When
		await handler.handle(new TodoUpdatedEvent(1, "user-123", false));

		// Then
		expect(todoReminder.cancelReminder).not.toHaveBeenCalled();
	});

	it("취소할 작업이 이미 없으면 missing을 정상 처리한다", async () => {
		// Given - 잡이 이미 처리됨
		jest.mocked(todoReminder.cancelReminder).mockResolvedValue({
			status: "missing",
		});

		// When & Then - 명시적 missing만 정상 처리
		await expect(
			handler.handle(new TodoUpdatedEvent(1, "user-123", true)),
		).resolves.toBeUndefined();
	});

	it("리마인더 인프라 실패를 전파한다", async () => {
		// Given - 리마인더 취소 실패 (기존 sync 핸들러의 유실을 RED로 포착)
		const error = new Error("scheduler down");
		const rejected = Promise.reject(error);
		void rejected.catch(() => undefined);
		jest.mocked(todoReminder.cancelReminder).mockReturnValue(rejected);

		// When & Then - 성공/missing으로 삼키지 않음
		await expect(
			handler.handle(new TodoUpdatedEvent(1, "user-123", true)),
		).rejects.toBe(error);
	});
});
