import { Injectable } from "@nestjs/common";

import { TodoPlanReaderPort } from "#api/modules/planning/todos/planning-todos.public";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";

import { PLANNING_UPCOMING_TODO_LIMIT } from "../../../planning/application/messages/planning-context.constants.js";
import type { ExistingTodo } from "../../../shared/domain/action-plan-dedupe.domain-service.js";
import { UpcomingTodoReaderPort } from "../../application/ports/upcoming-todo.reader.port.js";

@Injectable()
export class UpcomingTodoReaderAdapter extends UpcomingTodoReaderPort {
  readonly #todoReader: Pick<TodoPlanReaderPort, "findUpcoming">;

  constructor(todoReader: TodoPlanReaderPort) {
    super();
    this.#todoReader = todoReader;
  }

  findByUserId(userId: string, timezone: string): Promise<readonly ExistingTodo[]> {
    return this.#todoReader.findUpcoming(userId, {
      fromDate: todayInTimezone(timezone),
      limit: PLANNING_UPCOMING_TODO_LIMIT,
    });
  }
}
