import { Injectable } from "@nestjs/common";

import { TodoPlanReaderPort } from "#api/modules/planning/todos/planning-todos.public";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { plainDateToDate } from "#api/shared/domain/time/plain-date";

import { PLANNING_UPCOMING_TODO_LIMIT } from "../../../planning/application/messages/planning-context.constants.js";
import type { ExistingTodo } from "../../../shared/domain/action-plan-dedupe.domain-service.js";
import { localDateAt } from "../../../shared/domain/user-calendar.domain-service.js";
import { UpcomingTodoReaderPort } from "../../application/ports/upcoming-todo.reader.port.js";

@Injectable()
export class UpcomingTodoReaderAdapter extends UpcomingTodoReaderPort {
  readonly #todoReader: Pick<TodoPlanReaderPort, "findUpcoming">;
  readonly #clock: ClockPort;

  constructor(todoReader: TodoPlanReaderPort, clock: ClockPort) {
    super();
    this.#todoReader = todoReader;
    this.#clock = clock;
  }

  findByUserId(userId: UserId, timezone: string): Promise<readonly ExistingTodo[]> {
    return this.#todoReader.findUpcoming(userId, {
      fromDate: plainDateToDate(localDateAt(this.#clock.now(), timezone)),
      limit: PLANNING_UPCOMING_TODO_LIMIT,
    });
  }
}
