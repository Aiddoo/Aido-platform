import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/index";

import type {
  TodoDetailsPatch,
  TodoPersistenceSnapshot,
} from "../../../domain/aggregates/todos/todo.aggregate.js";
import type { UpdateTodoData } from "../../models/todos/todo.types.js";
import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import { type CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import {
  type TodoRepositoryPort,
  type TodoUpdatePatch,
} from "../../ports/todos/todo.repository.port.js";

export interface UpdateTodoInput {
  readonly id: number;
  readonly userId: string;
  readonly data: UpdateTodoData;
  readonly timezone: string;
}

interface UpdateTodoDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "updateDetails">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class UpdateTodo {
  readonly #dependencies: UpdateTodoDependencies;

  constructor(dependencies: UpdateTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoInput): Promise<TodoResponse> {
    const { id, userId, data, timezone } = input;

    const events = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todo(id),
        ...(data.categoryId === undefined ? [] : [MutationLockKeys.todoCategory(userId)]),
      ]);
      if (data.categoryId !== undefined) {
        // 일반 PATCH는 전용 category endpoint와 달리 활성 한도를 검사하지 않는다.
        await this.#dependencies.categoryOwnership.validateOwnership(data.categoryId, userId);
      }

      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo === null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      const wasCompleted = todo.isCompleted();
      const details: TodoDetailsPatch = { ...data, scheduledTime: undefined };
      if (data.scheduledTime !== undefined) {
        details.scheduledTime =
          data.scheduledTime === null
            ? null
            : parseLocalDateTime(
                toDateString(data.startDate ?? todo.toPersistence().startDate),
                data.scheduledTime,
                timezone,
              );
      }
      todo.updateDetails(details);
      const snapshot = todo.toPersistence();

      const patch: TodoUpdatePatch = {};
      const copyField = <
        K extends keyof UpdateTodoData & keyof TodoPersistenceSnapshot & keyof TodoUpdatePatch,
      >(
        key: K,
      ): void => {
        if (data[key] !== undefined) {
          patch[key] = snapshot[key];
        }
      };
      copyField("title");
      copyField("categoryId");
      copyField("startDate");
      copyField("endDate");
      copyField("scheduledTime");
      copyField("isAllDay");
      copyField("visibility");
      if (data.completed !== undefined) {
        patch.completed = snapshot.completed;
        if (snapshot.completed !== wasCompleted) {
          patch.completedAt = snapshot.completedAt;
        }
      }
      await this.#dependencies.todoRepository.updateDetails(id, patch);

      return todo.pullDomainEvents();
    });

    this.#dependencies.logger.log({ event: PlanningTodoLogEvent.UPDATED, todoId: id, userId });

    if (data.categoryId !== undefined) {
      await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    }
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    await this.#dependencies.eventPublisher.publishAll(events);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response === null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
