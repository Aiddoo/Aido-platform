import { Inject, Injectable } from "@nestjs/common";

import {
  TODO_PLAN_READER,
  type TodoPlanReaderPort,
} from "#api/modules/planning/todos/planning-todos.public";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";

import type { UpcomingTodoReaderPort } from "../../../application/ports/parsing/upcoming-todo-reader.port.js";
import { PLANNING_UPCOMING_TODO_LIMIT } from "../../../application/prompts/planning/planning-prompt.constants.js";
import type { ExistingTodo } from "../../../domain/policies/planning/action-plan-dedupe.policy.js";

@Injectable()
export class UpcomingTodoReaderAdapter implements UpcomingTodoReaderPort {
  constructor(
    @Inject(TODO_PLAN_READER)
    private readonly todoReader: Pick<TodoPlanReaderPort, "findUpcoming">,
  ) {}

  findByUserId(userId: string, timezone: string): Promise<readonly ExistingTodo[]> {
    return this.todoReader.findUpcoming(userId, {
      fromDate: todayInTimezone(timezone),
      limit: PLANNING_UPCOMING_TODO_LIMIT,
    });
  }
}
