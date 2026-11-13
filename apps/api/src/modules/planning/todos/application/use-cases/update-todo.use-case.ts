import type { TodoUpdateScope } from "@aido/api/vocabulary";
import type { TodoVisibility } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCategoryLockKeys } from "../../../categories/application/categories.lock-keys.js";
import { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type { Todo, TodoDetailsPatch, TodoEvent } from "../../../shared/domain/todo.aggregate.js";
import { type CategoryOwnershipPort } from "../ports/category-ownership.port.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort, type TodoUpdatePatch } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { todoNotFound, todoNotRepeating } from "../todos.errors.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import { TodoLogEvent } from "../todos.log-events.js";
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
  readonly events: readonly TodoEvent[];
}

interface UpdateTodoDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "updateDetails">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
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

  /** 활성 UoW 안에서 호출한다. 다른 수정과 한 트랜잭션으로 묶을 때 EditTodoUseCase가 부르고, 리마인더·이벤트 반영은 호출자가 고른다. */
  async apply(input: UpdateTodoInput): Promise<AppliedTodoUpdate> {
    const { id, userId, data, timezone } = input;
    const todoId = TodoId.reconstitute(id);
    const ownerId = UserId.reconstitute(userId);
    await this.#dependencies.mutationLock.acquire([
      TodoLockKeys.todo(id),
      ...(data.categoryId == null ? [] : [TodoCategoryLockKeys.userCategories(userId)]),
    ]);
    if (data.categoryId != null) {
      // 일반 PATCH는 전용 category endpoint와 달리 활성 한도를 검사하지 않는다.
      await this.#dependencies.categoryOwnership.validateOwnership(
        TodoCategoryId.reconstitute(data.categoryId),
        ownerId,
      );
    }

    const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, ownerId);
    if (todo == null) {
      throw todoNotFound(id);
    }

    if (input.scope != null && todo.seriesId == null) {
      throw todoNotRepeating(id, input.scope);
    }

    const wasCompleted = todo.completed;
    const { scheduledTime: scheduledLocalTime, ...details } = data;
    const patchDetails: TodoDetailsPatch = { ...details, scheduledLocalTime };
    if (todo.updateDetails(patchDetails, timezone, this.#dependencies.clock.now())) {
      await this.#dependencies.todoRepository.updateDetails(
        todoId,
        toUpdatePatch(data, todo, wasCompleted),
      );
    }

    return {
      id,
      userId,
      hasCategoryChanged: data.categoryId != null,
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

/** 요청이 보낸 칸만 쓴다. 벽시계·순간·종일은 함께 맞춰지므로 한쪽만 보내도 모두 저장한다. */
function toUpdatePatch(data: UpdateTodoData, todo: Todo, wasCompleted: boolean): TodoUpdatePatch {
  const { schedule } = todo;
  const touchesTime =
    // oxlint-disable-next-line aido/no-strict-nullish -- scheduledTime null은 시간 지우기다
    data.scheduledTime !== undefined || data.isAllDay != null || data.startDate != null;
  return {
    ...(data.title == null ? {} : { title: todo.title.value }),
    ...(data.categoryId == null
      ? {}
      : { categoryId: TodoCategoryId.reconstitute(todo.categoryId) }),
    ...(data.startDate == null ? {} : { startDate: schedule.startDate }),
    // oxlint-disable-next-line aido/no-strict-nullish -- endDate null은 종료일 지우기다
    ...(data.endDate === undefined ? {} : { endDate: schedule.endDate }),
    ...(touchesTime
      ? {
          scheduledLocalTime: schedule.scheduledLocalTime,
          scheduledTime: schedule.scheduledTime,
          isAllDay: schedule.isAllDay,
        }
      : {}),
    ...(data.visibility == null ? {} : { visibility: todo.visibility }),
    ...(data.completed == null ? {} : { completed: todo.completed }),
    ...(data.completed == null || todo.completed === wasCompleted
      ? {}
      : { completedAt: todo.completedAt }),
  };
}
