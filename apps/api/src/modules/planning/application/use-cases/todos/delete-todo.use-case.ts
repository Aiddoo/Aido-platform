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
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

export interface DeleteTodoInput {
  readonly id: number;
  readonly userId: string;
}

interface DeleteTodoDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "delete">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class DeleteTodo {
  readonly #dependencies: DeleteTodoDependencies;

  constructor(dependencies: DeleteTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoInput): Promise<void> {
    const { id, userId } = input;

    const events = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoCategory(userId),
        MutationLockKeys.todo(id),
      ]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo === null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      await this.#dependencies.todoRepository.delete(id);

      todo.markDeleted();
      return todo.pullDomainEvents();
    });

    await this.#dependencies.eventPublisher.publishAll(events);

    await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    this.#dependencies.logger.log({ event: PlanningTodoLogEvent.DELETED, todoId: id, userId });
  }
}
