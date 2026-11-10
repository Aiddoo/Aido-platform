import type { Todo } from "@aido/api";

import {
  type CreateTodoData,
  type StagedTodoCreation,
  StagedTodoCreatorPort,
} from "#api/modules/planning/planning-todos.public";
import { TodoBuilder } from "#test/builders/todo.builder";
import { createTodoResponseFixture } from "#test/fixtures/todo-response.fixture";

// 받은 입력을 남기고 입력 제목의 할 일을 하나 만든다. 반복이면 recurringTodos를 회차로 돌려준다
export class FakeStagedTodoCreator extends StagedTodoCreatorPort {
  readonly inputs: CreateTodoData[] = [];
  readonly settledTodoIds: number[] = [];
  recurringTodos: readonly Todo[] = [];
  failure: ((input: CreateTodoData) => unknown) | null = null;
  #nextTodoId = 1;

  async stage(input: CreateTodoData): Promise<StagedTodoCreation> {
    const error = this.failure?.(input);
    if (error != null) {
      throw error;
    }
    this.inputs.push(structuredClone(input));
    const todos = input.repeat == null ? [this.#createTodo(input)] : [...this.recurringTodos];
    return {
      todos,
      series: null,
      afterCommit: async () => {
        this.settledTodoIds.push(...todos.map((todo) => todo.id));
      },
    };
  }

  #createTodo(input: CreateTodoData): Todo {
    const record = TodoBuilder.create(input.userId)
      .withId(this.#nextTodoId)
      .withTitle(input.title)
      .withCategoryId(input.categoryId)
      .withStartDate(input.startDate)
      .withEndDate(input.endDate ?? null)
      .withIsAllDay(input.isAllDay ?? true)
      .withVisibility(input.visibility ?? "PUBLIC")
      .build();
    this.#nextTodoId += 1;
    return createTodoResponseFixture(record);
  }
}
