import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { TodoUpdateScope } from "@aido/api/vocabulary";
import type { TodoVisibility } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import {
  MutationLockKeys,
  type MutationLockPort,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import type { DomainEvent } from "#api/shared/domain/aggregate-root";

import type {
  TodoDetailsPatch,
  TodoPersistenceSnapshot,
} from "../../../shared/domain/todo.aggregate.js";
import { type CategoryOwnershipPort } from "../ports/category-ownership.port.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort, type TodoUpdatePatch } from "../ports/todo.repository.port.js";
import { TodoLogEvent } from "../todos.log-events.js";

export interface UpdateTodoData {
  readonly title?: string;
  readonly categoryId?: number;
  readonly startDate?: Date;
  readonly endDate?: Date | null;
  readonly scheduledTime?: string | null;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly completed?: boolean;
}

export interface UpdateTodoInput {
  readonly id: number;
  readonly userId: string;
  readonly data: UpdateTodoData;
  /** 해석이 끝난 시간대. EditTodoUseCase가 ResolveTodoTimezoneUseCase로 정해 넘긴다. */
  readonly timezone: string;
  /** 명시했는데 반복이 아니면 TODO_0844다. 회차 하나만 고쳐도 원래 회차 날짜는 그대로다. */
  readonly scope?: TodoUpdateScope;
}

/** UoW 안에서 저장을 끝낸 결과. 커밋 뒤 효과를 낼 재료만 담는다. */
export interface AppliedTodoUpdate {
  readonly id: number;
  readonly userId: string;
  readonly hasCategoryChanged: boolean;
  readonly events: readonly DomainEvent[];
}

interface UpdateTodoDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "updateDetails">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateTodoUseCase {
  readonly #dependencies: UpdateTodoDependencies;

  constructor(dependencies: UpdateTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoInput): Promise<TodoResponse> {
    const { id, userId } = input;
    const applied = await this.#dependencies.unitOfWork.run(() => this.apply(input));
    await this.publish(applied);
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }

  /** 활성 UoW 안에서 호출한다. 다른 수정과 한 트랜잭션으로 묶을 때 EditTodoUseCase가 부른다. */
  async apply(input: UpdateTodoInput): Promise<AppliedTodoUpdate> {
    const { id, userId, data, timezone } = input;
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
    const { scheduledTime: scheduledLocalTime, ...details } = data;
    const patchDetails: TodoDetailsPatch = { ...details, scheduledLocalTime };
    todo.updateDetails(patchDetails, timezone);
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
    if (data.scheduledTime !== undefined || data.isAllDay != null || data.startDate != null) {
      // 벽시계·순간·종일은 함께 맞춰지므로 한쪽만 보내도 모두 저장한다.
      patch.scheduledLocalTime = snapshot.scheduledLocalTime;
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

    return {
      id,
      userId,
      hasCategoryChanged: data.categoryId != null,
      events: todo.pullDomainEvents(),
    };
  }

  async publish(applied: AppliedTodoUpdate): Promise<void> {
    const { id, userId, hasCategoryChanged, events } = applied;
    this.#dependencies.logger.log({ event: TodoLogEvent.UPDATED, todoId: id, userId });

    if (hasCategoryChanged) {
      await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    }
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    await this.#dependencies.eventPublisher.publishAll(events);
  }
}
