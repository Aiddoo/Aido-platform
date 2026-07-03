import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../../../scheduler/reminder";
import { TodoDeletedEvent } from "../../domain/events/todo-deleted.event";

/**
 * Todo 삭제 이벤트 핸들러
 *
 * 삭제된 할 일의 리마인더를 취소합니다(레거시 동작 보존).
 */
@EventsHandler(TodoDeletedEvent)
export class TodoDeletedHandler implements IEventHandler<TodoDeletedEvent> {
	constructor(
		@Inject(REMINDER_SCHEDULER)
		private readonly reminderScheduler: IReminderScheduler,
	) {}

	handle(event: TodoDeletedEvent): void {
		this.reminderScheduler.cancelReminder(event.todoId);
	}
}
