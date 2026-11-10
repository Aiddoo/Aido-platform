import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { TodoCategoryLockKeys } from "../../../categories/application/categories.lock-keys.js";
import type { CreateTodoData } from "../ports/staged-todo-creator.port.js";
import type {
  StagedTodoCreation,
  StagedTodoCreatorPort,
} from "../ports/staged-todo-creator.port.js";
import { TodoLockKeys } from "../todos.lock-keys.js";

export type CreateTodoInput = CreateTodoData;
export type CreateTodoResult = Pick<StagedTodoCreation, "todos" | "series">;

interface CreateTodoDependencies {
  readonly todoCreator: StagedTodoCreatorPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
}

export class CreateTodoUseCase {
  readonly #dependencies: CreateTodoDependencies;

  constructor(dependencies: CreateTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateTodoInput): Promise<CreateTodoResult> {
    const staged = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(input.userId),
        TodoLockKeys.sortOrder(input.userId),
      ]);
      return this.#dependencies.todoCreator.stage(input);
    });

    // 알림·캐시 실패는 커밋 뒤 호출자에게 전달해 기존 응답 의미를 지킨다.
    await staged.afterCommit();

    return { todos: staged.todos, series: staged.series };
  }
}
