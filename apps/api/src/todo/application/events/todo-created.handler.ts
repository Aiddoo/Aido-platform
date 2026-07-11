import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TodoCreatedEvent } from "../../domain/events/todo-created.event";
import { TODO_EVENTS } from "../../domain/events/todo-event-names";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "../ports/todo-reminder.port";

/**
 * Todo 생성 이벤트 핸들러
 *
 * scheduledTime이 있으면 리마인더를 스케줄링합니다(실패는 로깅만, fire-and-forget).
 */
@Injectable()
export class TodoCreatedHandler {
	readonly #logger = new Logger(TodoCreatedHandler.name);

	constructor(
		@Inject(TODO_REMINDER)
		private readonly todoReminder: TodoReminderPort,
	) {}

	@OnEvent(TODO_EVENTS.CREATED)
	handle(event: TodoCreatedEvent): void {
		if (!event.scheduledTime) {
			return;
		}

		try {
			this.todoReminder.scheduleReminder(
				event.todoId,
				event.scheduledTime,
				event.userId,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to schedule reminder for todo ${event.todoId}: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
