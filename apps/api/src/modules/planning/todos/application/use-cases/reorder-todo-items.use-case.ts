import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../domain/todo-id.vo.js";
import { TodoItemId } from "../../domain/todo-item-id.vo.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { todoNotFound } from "../todos.errors.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import { TodoLogEvent } from "../todos.log-events.js";

export interface ReorderTodoItemsInput {
  readonly todoId: number;
  readonly userId: string;
  readonly itemIds: number[];
}

interface ReorderTodoItemsDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "lockByIdAndUserId" | "save">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class ReorderTodoItemsUseCase {
  readonly #dependencies: ReorderTodoItemsDependencies;

  constructor(dependencies: ReorderTodoItemsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderTodoItemsInput): Promise<TodoReadModel> {
    const { todoId, userId, itemIds } = input;
    const targetTodoId = TodoId.reconstitute(todoId);
    const ownerId = UserId.reconstitute(userId);

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([TodoLockKeys.todo(todoId)]);
      const todo = await this.#dependencies.todoRepository.lockByIdAndUserId(targetTodoId, ownerId);
      if (todo == null) {
        throw todoNotFound(todoId);
      }

      const reordered = todo.reorderItems(
        itemIds.map((itemId) => TodoItemId.reconstitute(itemId)),
        this.#dependencies.clock.now(),
      );
      if (!reordered) {
        return;
      }
      await this.#dependencies.todoRepository.save(todo);
    });

    this.#dependencies.logger.log({ event: TodoLogEvent.ITEMS_REORDERED, todoId, userId });

    await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      targetTodoId,
      ownerId,
    );
    if (response == null) {
      throw todoNotFound(todoId);
    }
    return response;
  }
}
