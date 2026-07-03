/**
 * TodoDeletedHandler 단위 테스트
 *
 * Suites + GWT 패턴
 */

import { TestBed } from "@suites/unit";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../../../scheduler/reminder";
import { TodoDeletedEvent } from "../../domain/events/todo-deleted.event";
import { TodoDeletedHandler } from "./todo-deleted.handler";

describe("TodoDeletedHandler — 삭제 이벤트 핸들러", () => {
	let handler: TodoDeletedHandler;
	let reminderScheduler: IReminderScheduler;

	beforeEach(async () => {
		reminderScheduler = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn(),
		};

		const { unit } = await TestBed.solitary(TodoDeletedHandler)
			.mock(REMINDER_SCHEDULER)
			.impl(() => reminderScheduler)
			.compile();

		handler = unit;
	});

	it("삭제된 할 일의 리마인더를 취소한다", () => {
		// Given & When
		handler.handle(new TodoDeletedEvent(1, "user-123"));

		// Then
		expect(reminderScheduler.cancelReminder).toHaveBeenCalledWith(1);
	});
});
