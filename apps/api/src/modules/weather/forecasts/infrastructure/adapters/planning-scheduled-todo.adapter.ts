import { Injectable } from "@nestjs/common";

import { TodoScheduleReaderPort } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { ScheduledTodoReaderPort } from "../../application/ports/scheduled-todo.reader.port.js";
import type { ScheduledTodo } from "../../application/read-models/scheduled-todo.read-model.js";

/** planning 조회 포트에서 날씨 브리핑에 필요한 칸(id·시각)만 꺼낸다. */
@Injectable()
export class PlanningScheduledTodoAdapter implements ScheduledTodoReaderPort {
  readonly #todoSchedule: Pick<TodoScheduleReaderPort, "listPendingTimedTodos">;

  constructor(todoSchedule: TodoScheduleReaderPort) {
    this.#todoSchedule = todoSchedule;
  }

  async listPendingTimedTodos(params: {
    readonly userId: UserId;
    readonly date: Temporal.PlainDate;
    readonly timezone: string;
    readonly from: Temporal.Instant;
    readonly until: Temporal.Instant;
  }): Promise<ScheduledTodo[]> {
    const todos = await this.#todoSchedule.listPendingTimedTodos({
      userIds: [params.userId.value],
      date: params.date,
      timezone: params.timezone,
      from: params.from,
      until: params.until,
    });
    return todos.map(({ id, scheduledAt }) => ({ id, scheduledAt }));
  }
}
