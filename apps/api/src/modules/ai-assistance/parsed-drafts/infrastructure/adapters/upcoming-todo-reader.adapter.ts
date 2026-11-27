import { Injectable } from "@nestjs/common";

import { TodoPlanReaderPort } from "#api/modules/planning/todos/planning-todos-queries.public";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/timezone-name";

import { PLANNING_UPCOMING_TODO_LIMIT } from "../../../action-plan-drafts/application/messages/planning-context.constants.js";
import type { ExistingTodo } from "../../../shared/domain/action-plan-dedupe.domain-service.js";
import { UpcomingTodoReaderPort } from "../../application/ports/upcoming-todo.reader.port.js";

@Injectable()
export class UpcomingTodoReaderAdapter extends UpcomingTodoReaderPort {
  readonly #todoReader: Pick<TodoPlanReaderPort, "listUpcoming">;
  readonly #clock: ClockPort;

  constructor(todoReader: TodoPlanReaderPort, clock: ClockPort) {
    super();
    this.#todoReader = todoReader;
    this.#clock = clock;
  }

  listByUserId(userId: UserId, timezone: string): Promise<readonly ExistingTodo[]> {
    return this.#todoReader.listUpcoming(userId, {
      fromDate: localDateIn(this.#clock.now(), timezone),
      limit: PLANNING_UPCOMING_TODO_LIMIT,
    });
  }
}
