import type { TodoUpdateScope, TodoVisibility } from "@aido/api/vocabulary";

import {
  TodoCategoryLockKeys,
  TodoCategoryId,
} from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { todoNotRepeating } from "#api/modules/planning/todo-series/planning-todo-series.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../domain/todo-id.vo.js";
import type { TodoEvent } from "../../domain/todo.aggregate.js";
import { type CategoryOwnershipPort } from "../ports/category-ownership.port.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { todoNotFound } from "../todos.errors.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import { TodoLogEvent } from "../todos.log-events.js";
import type { ApplyTodoCompletionEffectsUseCase } from "./apply-todo-completion-effects.use-case.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

export interface UpdateTodoData {
  readonly title?: string;
  readonly categoryId?: number;
  readonly startDate?: Temporal.PlainDate;
  readonly endDate?: Temporal.PlainDate | null;
  readonly scheduledTime?: string | null;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly completed?: boolean;
}

export interface UpdateTodoInput {
  readonly id: number;
  readonly userId: string;
  readonly data: UpdateTodoData;
  // 해석이 끝난 시간대. EditTodoUseCase가 ResolveTodoTimezoneUseCase로 정해 넘긴다
  readonly timezone: string;
  // 명시했는데 반복이 아니면 TODO_0844다. 회차 하나만 고쳐도 원래 회차 날짜는 그대로다
  readonly scope?: TodoUpdateScope;
}

// UoW 안에서 저장을 끝낸 결과. 커밋 뒤 효과를 낼 재료만 담는다
export interface AppliedTodoUpdate {
  readonly id: number;
  readonly userId: string;
  readonly hasCategoryChanged: boolean;
  readonly events: readonly TodoEvent[];
}

interface UpdateTodoDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "lockByIdAndUserId" | "save">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly completionEffects: Pick<ApplyTodoCompletionEffectsUseCase, "execute">;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateTodoUseCase {
  readonly #dependencies: UpdateTodoDependencies;

  constructor(dependencies: UpdateTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoInput): Promise<TodoReadModel> {
    const { id, userId } = input;
    const applied = await this.#dependencies.unitOfWork.run(async () => {
      const updated = await this.apply(input);
      await this.#dependencies.applyTodoEvents.execute(updated.events);
      await this.#dependencies.completionEffects.execute(updated.events);
      return updated;
    });
    await this.publish(applied);
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      TodoId.reconstitute(id),
      UserId.reconstitute(userId),
    );
    if (response == null) {
      throw todoNotFound(id);
    }
    return response;
  }

  // 활성 UoW 안에서 호출한다. EditTodoUseCase가 다른 수정과 한 트랜잭션으로 묶고, 이벤트 반영 순서는 호출자가 고른다
  async apply(input: UpdateTodoInput): Promise<AppliedTodoUpdate> {
    const { id, userId, data, timezone } = input;
    const todoId = TodoId.reconstitute(id);
    const ownerId = UserId.reconstitute(userId);
    const categoryId =
      data.categoryId == null ? null : TodoCategoryId.reconstitute(data.categoryId);
    await this.#dependencies.mutationLock.acquire([
      ...(categoryId == null ? [] : [TodoCategoryLockKeys.userCategories(userId)]),
      TodoLockKeys.todo(id),
    ]);
    if (categoryId != null) {
      // 일반 PATCH는 전용 category endpoint와 달리 활성 한도를 검사하지 않는다
      await this.#dependencies.categoryOwnership.validateOwnership(categoryId, ownerId);
    }

    const todo = await this.#dependencies.todoRepository.lockByIdAndUserId(todoId, ownerId);
    if (todo == null) {
      throw todoNotFound(id);
    }
    if (input.scope != null && !todo.isOccurrence()) {
      throw todoNotRepeating(id, input.scope);
    }

    const { scheduledTime: scheduledLocalTime, categoryId: _categoryId, ...details } = data;
    const changed = todo.updateDetails(
      { ...details, scheduledLocalTime, ...(categoryId == null ? {} : { categoryId }) },
      timezone,
      this.#dependencies.clock.now(),
    );
    if (changed) {
      await this.#dependencies.todoRepository.save(todo);
    }

    return {
      id,
      userId,
      hasCategoryChanged: categoryId != null,
      events: todo.pullDomainEvents(),
    };
  }

  async publish(applied: AppliedTodoUpdate): Promise<void> {
    const { id, userId, hasCategoryChanged } = applied;
    this.#dependencies.logger.log({ event: TodoLogEvent.UPDATED, todoId: id, userId });

    const ownerId = UserId.reconstitute(userId);
    if (hasCategoryChanged) {
      await this.#dependencies.todoCache.invalidateTodoCategories(ownerId);
    }
    await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);
  }
}
