import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { TodoCreatedEvent } from "../../../shared/domain/todo-created.event.js";
import { TODO_EVENTS } from "../../../shared/domain/todo-event-names.constants.js";
import {
  TODO_REMINDER,
  type TodoReminderPort,
} from "../../application/ports/todo-reminder-scheduler.port.js";

/**
 * Todo 생성 이벤트 핸들러
 *
 * scheduledTime이 있으면 리마인더를 스케줄링하고 완료까지 기다립니다.
 * 실패는 이벤트 publisher 경계까지 전파되어 관측됩니다.
 */
@Injectable()
export class TodoCreatedHandler {
  readonly #todoReminder: TodoReminderPort;

  constructor(
    @Inject(TODO_REMINDER)
    todoReminder: TodoReminderPort,
  ) {
    this.#todoReminder = todoReminder;
  }

  @OnEvent(TODO_EVENTS.CREATED, { suppressErrors: false })
  async handle(event: TodoCreatedEvent): Promise<void> {
    if (!event.scheduledTime) {
      return;
    }

    await this.#todoReminder.scheduleReminder(event.todoId, event.scheduledTime, event.userId);
  }
}
