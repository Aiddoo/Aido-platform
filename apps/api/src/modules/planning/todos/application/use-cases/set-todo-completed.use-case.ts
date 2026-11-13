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
import type { ApplyTodoCompletionEffectsUseCase } from "./apply-todo-completion-effects.use-case.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

export interface ToggleTodoCompleteInput {
  readonly id: number;
  readonly userId: string;
  readonly completed: boolean;
  /** 스트릭의 "오늘" 경계 */
  readonly timezone: string;
}

interface ToggleTodoCompleteDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "updateDetails">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly completionEffects: Pick<ApplyTodoCompletionEffectsUseCase, "execute">;
  readonly logger: ApplicationLoggerPort;
}

export class SetTodoCompletedUseCase {
  readonly #dependencies: ToggleTodoCompleteDependencies;

  constructor(dependencies: ToggleTodoCompleteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ToggleTodoCompleteInput): Promise<TodoReadModel> {
    const { id, userId, completed, timezone } = input;
    const todoId = TodoId.reconstitute(id);
    const ownerId = UserId.reconstitute(userId);

    const events = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([TodoLockKeys.todo(id)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, ownerId);
      if (todo == null) {
        throw todoNotFound(id);
      }

      const changed = todo.toggleComplete(completed, timezone, this.#dependencies.clock.now());
      if (!changed) {
        return [];
      }

      await this.#dependencies.todoRepository.updateDetails(todoId, {
        completed: todo.completed,
        completedAt: todo.completedAt,
      });

      this.#dependencies.logger.log({
        event: TodoLogEvent.COMPLETION_CHANGED,
        todoId: id,
        userId,
        completed,
      });
      const events = todo.pullDomainEvents();
      await this.#dependencies.applyTodoEvents.execute(events);
      return events;
    });

    await this.#dependencies.completionEffects.execute(events);

    await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, ownerId);
    if (response == null) {
      throw todoNotFound(id);
    }
    return response;
  }
}
