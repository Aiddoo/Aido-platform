import type { Todo } from "@aido/api";

import type {
  CreateTodoData,
  CreateRecurringTodoData,
  StagedTodoCreation,
  StagedTodoCreatorPort,
} from "#api/modules/notes/application/ports/memos/staged-todo-creator.port";
import { TodoBuilder } from "#test/builders/todo.builder";
import { createTodoResponseFixture } from "#test/fixtures/todo-response.fixture";

export class StubNotesTodoCreator implements StagedTodoCreatorPort {
  readonly singleInputs: CreateTodoData[] = [];
  readonly recurringInputs: Array<{ data: CreateRecurringTodoData; timezone: string }> = [];
  readonly stagedTodos = new Map<number, Todo>();
  readonly settledTodoIds: number[] = [];
  recurringResult: readonly Todo[] = [];

  async stageTodo(data: CreateTodoData): Promise<StagedTodoCreation> {
    this.singleInputs.push(structuredClone(data));
    const record = TodoBuilder.create(data.userId)
      .withId(this.stagedTodos.size + 1)
      .withTitle(data.title)
      .withCategoryId(data.categoryId)
      .withStartDate(data.startDate)
      .withEndDate(data.endDate ?? null)
      .withScheduledTime(data.scheduledTime ?? null)
      .withIsAllDay(data.isAllDay ?? true)
      .withVisibility(data.visibility ?? "PUBLIC")
      .build();
    return this.#stage([createTodoResponseFixture(record)]);
  }

  async stageRecurringTodos(
    data: CreateRecurringTodoData,
    timezone: string,
  ): Promise<StagedTodoCreation> {
    this.recurringInputs.push({ data: structuredClone(data), timezone });
    return this.#stage(this.recurringResult);
  }

  #stage(todos: readonly Todo[]): StagedTodoCreation {
    const staged = structuredClone(todos);
    for (const todo of staged) this.stagedTodos.set(todo.id, todo);
    return {
      todos: staged,
      afterCommit: async () => {
        this.settledTodoIds.push(...staged.map((todo) => todo.id));
      },
    };
  }
}
