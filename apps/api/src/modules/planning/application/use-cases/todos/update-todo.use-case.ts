import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { TodoUpdateScope } from "@aido/api/vocabulary";

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
  /** 명시했는데 반복이 아니면 TODO_0844다. 회차 하나만 고쳐도 원래 회차 날짜는 그대로다. */
  readonly scope?: TodoUpdateScope;
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
        ...(data.categoryId == null ? [] : [MutationLockKeys.todoCategory(userId)]),
      ]);
      if (data.categoryId != null) {
        // 일반 PATCH는 전용 category endpoint와 달리 활성 한도를 검사하지 않는다.
        await this.#dependencies.categoryOwnership.validateOwnership(data.categoryId, userId);
      }

      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      if (input.scope != null && todo.getSeriesId() == null) {
        throw new ApplicationException(ErrorCode.TODO_0844, { todoId: id, scope: input.scope });
      }

      const wasCompleted = todo.isCompleted();
      const details: TodoDetailsPatch = { ...data, scheduledTime: undefined };
      // nullish-strict: PATCH라 undefined는 유지, null은 시간 지우기다
      if (data.scheduledTime !== undefined) {
        details.scheduledTime =
          data.scheduledTime == null
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
        // nullish-strict: null로 비운 필드도 저장할 변경이다
        if (data[key] !== undefined) {
          patch[key] = snapshot[key];
        }
      };
      copyField("title");
      copyField("categoryId");
      copyField("startDate");
      copyField("endDate");
      // nullish-strict: scheduledTime null은 시간 지우기다
      if (data.scheduledTime !== undefined || data.isAllDay != null) {
        // 종일과 시간은 함께 맞춰지므로 한쪽만 보내도 둘 다 저장한다.
        patch.scheduledTime = snapshot.scheduledTime;
        patch.isAllDay = snapshot.isAllDay;
      }
      copyField("visibility");
      if (data.completed != null) {
        patch.completed = snapshot.completed;
        if (snapshot.completed !== wasCompleted) {
          patch.completedAt = snapshot.completedAt;
        }
      }
      await this.#dependencies.todoRepository.updateDetails(id, patch);

      return todo.pullDomainEvents();
    });

    this.#dependencies.logger.log({ event: PlanningTodoLogEvent.UPDATED, todoId: id, userId });

    if (data.categoryId != null) {
      await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    }
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    await this.#dependencies.eventPublisher.publishAll(events);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
