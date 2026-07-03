/**
 * TodoUpdatedHandler 단위 테스트
 *
 * Suites + GWT 패턴 — 완료 요청 여부에 따른 리마인더 취소 분기 검증
 */

import { TestBed } from "@suites/unit";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../../../scheduler/reminder";
import { TodoUpdatedEvent } from "../../domain/events/todo-updated.event";
import { TodoUpdatedHandler } from "./todo-updated.handler";

describe("TodoUpdatedHandler — 부분 수정 이벤트 핸들러", () => {
	let handler: TodoUpdatedHandler;
	let reminderScheduler: IReminderScheduler;

	beforeEach(async () => {
		reminderScheduler = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn(),
		};

		const { unit } = await TestBed.solitary(TodoUpdatedHandler)
			.mock(REMINDER_SCHEDULER)
			.impl(() => reminderScheduler)
			.compile();

		handler = unit;
	});

	it("완료 요청(completed=true)이면 리마인더를 취소한다", () => {
		// Given & When
		handler.handle(new TodoUpdatedEvent(1, "user-123", true));

		// Then
		expect(reminderScheduler.cancelReminder).toHaveBeenCalledWith(1);
	});

	it("미완료 요청(completed=false)이면 리마인더를 취소하지 않는다", () => {
		// Given & When
		handler.handle(new TodoUpdatedEvent(1, "user-123", false));

		// Then
		expect(reminderScheduler.cancelReminder).not.toHaveBeenCalled();
	});

	it("완료 필드가 없는 수정(undefined)이면 리마인더를 취소하지 않는다", () => {
		// Given & When
		handler.handle(new TodoUpdatedEvent(1, "user-123", undefined));

		// Then
		expect(reminderScheduler.cancelReminder).not.toHaveBeenCalled();
	});
});
