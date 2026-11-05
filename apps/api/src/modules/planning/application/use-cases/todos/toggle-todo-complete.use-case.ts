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
import type { TodoTimezoneResolver } from "../../services/todos/todo-timezone-resolver.service.js";

export interface ToggleTodoCompleteInput {
  readonly id: number;
  readonly userId: string;
  readonly completed: boolean;
  /** 스트릭의 "오늘" 경계 */
  readonly timezone: string;
  /** 완료를 되돌릴 때 벽시계를 해석할 요청 시간대. 없으면 저장된 사용자 시간대다. */
  readonly requestTimezone: string | undefined;
}

interface ToggleTodoCompleteDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "updateDetails">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly timezoneResolver: Pick<TodoTimezoneResolver, "resolve">;
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
    const scheduleTimezone = await this.#dependencies.timezoneResolver.resolve(
      userId,
      input.requestTimezone,
    );

    const events = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todo(id)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      const changed = todo.toggleComplete(completed, timezone, scheduleTimezone);
      if (!changed) {
        return [];
      }

      const snapshot = todo.toPersistence();
      await this.#dependencies.todoRepository.updateDetails(id, {
        completed: snapshot.completed,
        completedAt: snapshot.completedAt,
        scheduledLocalTime: snapshot.scheduledLocalTime,
        scheduledTime: snapshot.scheduledTime,
      });

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
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
