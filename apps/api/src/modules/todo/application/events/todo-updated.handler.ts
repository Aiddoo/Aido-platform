import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../../../scheduler/reminder";
import { TodoUpdatedEvent } from "../../domain/events/todo-updated.event";

/**
 * Todo 수정 이벤트 핸들러
 *
 * 완료 요청(completed=true)일 때만 리마인더를 취소합니다.
 * 부분 수정은 스트릭·마일스톤·친구 완료 알림을 트리거하지 않습니다
 * (그 부수효과는 완료 토글 전용 — TodoToggledEvent가 담당, 레거시 동작 보존).
 */
@EventsHandler(TodoUpdatedEvent)
export class TodoUpdatedHandler implements IEventHandler<TodoUpdatedEvent> {
	constructor(
		@Inject(REMINDER_SCHEDULER)
		private readonly reminderScheduler: IReminderScheduler,
	) {}

	handle(event: TodoUpdatedEvent): void {
		if (event.completed !== true) {
			return;
		}

		this.reminderScheduler.cancelReminder(event.todoId);
	}
}
