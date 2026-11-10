import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import {
  MutationLockKeys,
  type DomainEventPublisherPort,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import { PlanningTodoLogEvent } from "../todos.log-events.js";

export interface AddTodoItemInput {
  readonly todoId: number;
  readonly userId: string;
  readonly title: string;
  /** 완료를 되돌릴 때 스트릭의 "오늘" 경계 */
  readonly timezone: string;
}

interface AddTodoItemDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "findByIdAndUserId" | "createItem" | "updateDetails"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLoggerPort;
}

export class AddTodoItem {
  readonly #dependencies: AddTodoItemDependencies;

  constructor(dependencies: AddTodoItemDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: AddTodoItemInput): Promise<TodoResponse> {
    const { todoId, userId, title, timezone } = input;

    const events = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todo(todoId)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      const plan = todo.planItemAddition(title);
      await this.#dependencies.todoRepository.createItem(todoId, plan);

      if (!todo.reopenForAddedItem(timezone)) {
        return [];
      }
      const snapshot = todo.toPersistence();
      await this.#dependencies.todoRepository.updateDetails(todoId, {
        completed: snapshot.completed,
        completedAt: snapshot.completedAt,
      });
      this.#dependencies.logger.log({
        event: PlanningTodoLogEvent.COMPLETION_CHANGED,
        todoId,
        userId,
        completed: snapshot.completed,
      });
      return todo.pullDomainEvents();
    });

    this.#dependencies.logger.log({ event: PlanningTodoLogEvent.ITEM_ADDED, todoId, userId });

    await this.#dependencies.eventPublisher.publishAll(events);

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    return response;
  }
}
