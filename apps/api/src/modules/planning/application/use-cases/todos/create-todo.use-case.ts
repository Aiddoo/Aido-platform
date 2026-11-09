import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import type { CreateTodoData } from "../../models/todos/todo.types.js";
import type {
  StagedTodoCreation,
  StagedTodoCreatorPort,
} from "../../ports/todos/staged-todo-creator.port.js";

export type CreateTodoInput = CreateTodoData;
export type CreateTodoResult = Pick<StagedTodoCreation, "todos" | "series">;

interface CreateTodoDependencies {
  readonly todoCreator: StagedTodoCreatorPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
}

export class CreateTodo {
  readonly #dependencies: CreateTodoDependencies;

  constructor(dependencies: CreateTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateTodoInput): Promise<CreateTodoResult> {
    const staged = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoCategory(input.userId),
        MutationLockKeys.todoSortOrder(input.userId),
      ]);
      return this.#dependencies.todoCreator.stage(input);
    });

    // 알림·캐시 실패는 커밋 뒤 호출자에게 전달해 기존 응답 의미를 지킨다.
    await staged.afterCommit();

    return { todos: staged.todos, series: staged.series };
  }
}
