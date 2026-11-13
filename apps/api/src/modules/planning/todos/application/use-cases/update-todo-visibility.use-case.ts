import type { TodoVisibility } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { todoNotFound } from "../todos.errors.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import { TodoLogEvent } from "../todos.log-events.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

export interface UpdateTodoVisibilityInput {
  readonly id: number;
  readonly userId: string;
  readonly visibility: TodoVisibility;
}

interface UpdateTodoVisibilityDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "updateVisibility">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateTodoVisibilityUseCase {
  readonly #dependencies: UpdateTodoVisibilityDependencies;

  constructor(dependencies: UpdateTodoVisibilityDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoVisibilityInput): Promise<TodoReadModel> {
    const { id, userId, visibility } = input;
    const todoId = TodoId.reconstitute(id);
    const ownerId = UserId.reconstitute(userId);

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([TodoLockKeys.todo(id)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, ownerId);
      if (todo == null) {
        throw todoNotFound(id);
      }

      if (!todo.changeVisibility(visibility, this.#dependencies.clock.now())) {
        return;
      }
      await this.#dependencies.todoRepository.updateVisibility(todoId, todo.visibility);
      await this.#dependencies.applyTodoEvents.execute(todo.pullDomainEvents());
    });

    this.#dependencies.logger.log({
      event: TodoLogEvent.VISIBILITY_UPDATED,
      todoId: id,
      userId,
      visibility,
    });

    await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, ownerId);
    if (response == null) {
      throw todoNotFound(id);
    }
    return response;
  }
}
