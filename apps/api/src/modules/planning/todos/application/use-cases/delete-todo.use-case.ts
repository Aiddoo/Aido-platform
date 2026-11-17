import type { TodoEditScope } from "@aido/api/vocabulary";

import { TodoCategoryLockKeys } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { DeleteTodoOccurrencesUseCase } from "#api/modules/planning/todo-series/planning-todo-series.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../domain/todo-id.vo.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import { todoNotFound, todoNotRepeating } from "../todos.errors.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import { TodoLogEvent } from "../todos.log-events.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

export interface DeleteTodoInput {
  readonly id: number;
  readonly userId: string;
  // 생략은 THIS_ONLY와 같고, 명시했는데 반복이 아니면 TODO_0844다
  readonly scope?: TodoEditScope;
}

interface DeleteTodoDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "delete">;
  readonly deleteOccurrences: Pick<DeleteTodoOccurrencesUseCase, "execute">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLoggerPort;
}

export class DeleteTodoUseCase {
  readonly #dependencies: DeleteTodoDependencies;

  constructor(dependencies: DeleteTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoInput): Promise<void> {
    const { id, userId, scope = "THIS_ONLY" } = input;
    if (scope !== "THIS_ONLY") {
      await this.#dependencies.deleteOccurrences.execute({ todoId: id, userId, scope });
      return;
    }
    const todoId = TodoId.reconstitute(id);
    const ownerId = UserId.reconstitute(userId);

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(userId),
        TodoLockKeys.todo(id),
      ]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, ownerId);
      if (todo == null) {
        throw todoNotFound(id);
      }
      if (input.scope != null && !todo.isOccurrence()) {
        throw todoNotRepeating(id, input.scope);
      }

      await this.#dependencies.todoRepository.delete(todo);
      todo.markDeleted();
      await this.#dependencies.applyTodoEvents.execute(todo.pullDomainEvents());
    });

    await this.#dependencies.todoCache.invalidateTodoCategories(ownerId);
    await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);

    this.#dependencies.logger.log({ event: TodoLogEvent.DELETED, todoId: id, userId });
  }
}
