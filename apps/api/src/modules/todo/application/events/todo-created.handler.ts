import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../../../scheduler/reminder";
import { TodoCreatedEvent } from "../../domain/events/todo-created.event";

/**
 * Todo 생성 이벤트 핸들러
 *
 * scheduledTime이 있으면 리마인더를 스케줄링합니다(실패는 로깅만, fire-and-forget).
 */
@EventsHandler(TodoCreatedEvent)
export class TodoCreatedHandler implements IEventHandler<TodoCreatedEvent> {
	readonly #logger = new Logger(TodoCreatedHandler.name);

	constructor(
		@Inject(REMINDER_SCHEDULER)
		private readonly reminderScheduler: IReminderScheduler,
	) {}

	handle(event: TodoCreatedEvent): void {
		if (!event.scheduledTime) {
			return;
		}

		try {
			this.reminderScheduler.scheduleReminder(
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
