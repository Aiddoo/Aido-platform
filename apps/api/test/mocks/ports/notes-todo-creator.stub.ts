import type { Todo } from "@aido/api";

import type {
  CreateTodoData,
  StagedTodoCreation,
  StagedTodoCreatorPort,
} from "#api/modules/planning/planning-todos.public";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { TodoBuilder } from "#test/builders/todo.builder";
import { createTodoResponseFixture } from "#test/fixtures/todo-response.fixture";

export class StubNotesTodoCreator implements StagedTodoCreatorPort {
  readonly singleInputs: CreateTodoData[] = [];
  readonly recurringInputs: CreateTodoData[] = [];
  readonly stagedTodos = new Map<number, Todo>();
  readonly settledTodoIds: number[] = [];
  recurringResult: readonly Todo[] = [];

  async stage(data: CreateTodoData): Promise<StagedTodoCreation> {
    if (data.recurrence != null) {
      this.recurringInputs.push(structuredClone(data));
      return this.#stage(this.recurringResult);
    }
    this.singleInputs.push(structuredClone(data));
    const record = TodoBuilder.create(data.userId)
      .withId(this.stagedTodos.size + 1)
      .withTitle(data.title)
      .withCategoryId(data.categoryId)
      .withStartDate(data.startDate)
      .withEndDate(data.endDate ?? null)
      .withScheduledTime(
        data.scheduledTime == null
          ? null
          : parseLocalDateTime(toDateString(data.startDate), data.scheduledTime, data.timezone),
      )
      .withIsAllDay(data.isAllDay ?? true)
      .withVisibility(data.visibility ?? "PUBLIC")
      .build();
    return this.#stage([createTodoResponseFixture(record)]);
  }

  #stage(todos: readonly Todo[]): StagedTodoCreation {
    const staged = structuredClone(todos);
    for (const todo of staged) {
      this.stagedTodos.set(todo.id, todo);
    }
    return {
      todos: staged,
      afterCommit: async () => {
        this.settledTodoIds.push(...staged.map((todo) => todo.id));
      },
    };
  }
}
