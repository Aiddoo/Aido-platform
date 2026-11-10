import type { Todo } from "@aido/api";

import type {
  MemoTodoCreatorPort,
  MemoTodoDraft,
} from "#api/modules/notes/memos/application/ports/memo-todo-creator.port";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { TodoBuilder } from "#test/builders/todo.builder";
import { createTodoResponseFixture } from "#test/fixtures/todo-response.fixture";

export class StubNotesTodoCreator implements MemoTodoCreatorPort {
  readonly singleInputs: MemoTodoDraft[] = [];
  readonly recurringInputs: MemoTodoDraft[] = [];
  readonly stagedTodos = new Map<number, Todo>();
  readonly settledTodoIds: number[] = [];
  recurringResult: readonly Todo[] = [];

  async stage(data: MemoTodoDraft): ReturnType<MemoTodoCreatorPort["stage"]> {
    if (data.repeat != null) {
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

  #stage(todos: readonly Todo[]): Awaited<ReturnType<MemoTodoCreatorPort["stage"]>> {
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
