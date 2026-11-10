import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { TODO_EVENTS } from "../../../shared/domain/todo-event-names.constants.js";
import { TodoRescheduledEvent } from "../../../shared/domain/todo-rescheduled.event.js";
import {
  TODO_REMINDER,
  type TodoReminderPort,
} from "../../application/ports/todo-reminder-scheduler.port.js";

/**
 * Todo 일정 변경 이벤트 핸들러
 *
 * scheduledTime이 있으면 리마인더를 재스케줄, 없으면 취소합니다.
 * 취소할 잡이 없는 경우는 정상 처리하고, 인프라 실패는 이벤트 경계까지 전파합니다.
 */
@Injectable()
export class TodoRescheduledHandler {
  readonly #todoReminder: TodoReminderPort;

  constructor(
    @Inject(TODO_REMINDER)
    todoReminder: TodoReminderPort,
  ) {
    this.#todoReminder = todoReminder;
  }

  @OnEvent(TODO_EVENTS.RESCHEDULED, { suppressErrors: false })
  async handle(event: TodoRescheduledEvent): Promise<void> {
    if (event.scheduledTime) {
      await this.#todoReminder.scheduleReminder(event.todoId, event.scheduledTime, event.userId);
      return;
    }

    await this.#todoReminder.cancelReminders([event.todoId]);
  }
}
