import {
  type CreateTodoData,
  type StagedTodoCreation,
  StagedTodoCreatorPort,
  type TodoReadModel,
} from "#api/modules/planning/todos/planning-todos.public";
import { plainDateFromDate } from "#api/shared/domain/time/plain-date";
import { createTodoReadModelFixture } from "#test/fixtures/planning/todo-read-model.fixture";

// 받은 입력을 남기고 입력 제목의 할 일을 하나 만든다. 반복이면 recurringTodos를 회차로 돌려준다
export class FakeStagedTodoCreator extends StagedTodoCreatorPort {
  readonly inputs: CreateTodoData[] = [];
  readonly settledTodoIds: number[] = [];
  recurringTodos: readonly TodoReadModel[] = [];
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

  #createTodo(input: CreateTodoData): TodoReadModel {
    const todo = createTodoReadModelFixture({
      id: this.#nextTodoId,
      userId: input.userId,
      title: input.title,
      startDate: plainDateFromDate(input.startDate).toString(),
      endDate: input.endDate == null ? null : plainDateFromDate(input.endDate).toString(),
      isAllDay: input.isAllDay ?? true,
      visibility: input.visibility ?? "PUBLIC",
    });
    this.#nextTodoId += 1;
    return { ...todo, category: { ...todo.category, id: input.categoryId } };
  }
}
