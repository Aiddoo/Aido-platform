import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TODO_EVENTS } from "../../domain/events/todo-event-names";
import { TodoRescheduledEvent } from "../../domain/events/todo-rescheduled.event";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "../ports/todo-reminder.port";

/**
 * Todo 일정 변경 이벤트 핸들러
 *
 * scheduledTime이 있으면 리마인더를 재스케줄, 없으면 취소합니다.
 * 취소할 잡이 없는 경우는 정상 처리하고, 인프라 실패는 이벤트 경계까지 전파합니다.
 */
@Injectable()
export class TodoRescheduledHandler {
	constructor(
		@Inject(TODO_REMINDER)
		private readonly todoReminder: TodoReminderPort,
	) {}

	@OnEvent(TODO_EVENTS.RESCHEDULED, { suppressErrors: false })
	async handle(event: TodoRescheduledEvent): Promise<void> {
		if (event.scheduledTime) {
			await this.todoReminder.scheduleReminder(
				event.todoId,
				event.scheduledTime,
				event.userId,
			);
			return;
		}

		await this.todoReminder.cancelReminder(event.todoId);
	}
}
