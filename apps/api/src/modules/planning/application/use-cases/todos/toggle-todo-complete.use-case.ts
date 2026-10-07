import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

export interface ToggleTodoCompleteInput {
  readonly id: number;
  readonly userId: string;
  readonly completed: boolean;
  readonly timezone: string;
}

interface ToggleTodoCompleteDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "updateCompletion">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class ToggleTodoComplete {
  readonly #dependencies: ToggleTodoCompleteDependencies;

  constructor(dependencies: ToggleTodoCompleteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ToggleTodoCompleteInput): Promise<TodoResponse> {
    const { id, userId, completed, timezone } = input;

    const events = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todo(id)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo === null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      const changed = todo.toggleComplete(completed, timezone);
      if (!changed) {
        return [];
      }

      await this.#dependencies.todoRepository.updateCompletion(
        id,
        todo.isCompleted(),
        todo.getCompletedAt(),
      );

      this.#dependencies.logger.log({
        event: PlanningTodoLogEvent.COMPLETION_CHANGED,
        todoId: id,
        userId,
        completed,
      });
      return todo.pullDomainEvents();
    });

    await this.#dependencies.eventPublisher.publishAll(events);

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response === null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
