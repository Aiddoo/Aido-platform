import { ScheduledTodoReaderPort } from "#api/modules/weather/forecasts/application/ports/scheduled-todo.reader.port";
import type { ScheduledTodo } from "#api/modules/weather/forecasts/application/read-models/scheduled-todo.read-model";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

interface StoredTodo extends ScheduledTodo {
  readonly userId: string;
}

export class InMemoryScheduledTodoReader extends ScheduledTodoReaderPort {
  readonly #todos: StoredTodo[];
  failure: Error | null = null;

  constructor(todos: readonly StoredTodo[] = []) {
    super();
    this.#todos = [...todos];
  }

  async listPendingTimedTodos(params: {
    readonly userId: UserId;
    readonly date: Temporal.PlainDate;
    readonly timezone: string;
    readonly from: Temporal.Instant;
    readonly until: Temporal.Instant;
  }): Promise<ScheduledTodo[]> {
    if (this.failure != null) {
      throw this.failure;
    }
    return this.#todos
      .filter(
        (todo) =>
          todo.userId === params.userId.value &&
          Temporal.Instant.compare(todo.scheduledAt, params.from) >= 0 &&
          Temporal.Instant.compare(todo.scheduledAt, params.until) < 0,
      )
      .toSorted((left, right) => Temporal.Instant.compare(left.scheduledAt, right.scheduledAt))
      .map(({ id, scheduledAt }) => ({ id, scheduledAt }));
  }
}
