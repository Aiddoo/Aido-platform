import { TODO_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";

import type { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { sortOrderAfterLast } from "../../../shared/domain/todo-sort-order.domain-service.js";
import { TodoTitle } from "../../../shared/domain/todo-title.vo.js";
import { TodoSchedule } from "../../domain/todo-schedule.vo.js";
import { Todo, type TodoEvent } from "../../domain/todo.aggregate.js";
import type { CategoryOwnershipPort } from "../ports/category-ownership.port.js";
import type { ResolvedCreateTodoData } from "../ports/staged-todo-creator.port.js";
import type { TodoRepositoryPort } from "../ports/todo.repository.port.js";
import { categoryTodoLimitReached } from "../todos.errors.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

/** 잠금 전에 검증을 마친 단일 할 일 입력. 제목·일정 오류가 소유·한도 오류보다 먼저다. */
export interface SingleTodoSpec {
  readonly userId: UserId;
  readonly categoryId: TodoCategoryId;
  readonly title: TodoTitle;
  readonly schedule: TodoSchedule;
  readonly visibility: TodoVisibility;
}

export function toSingleTodoSpec(input: ResolvedCreateTodoData): SingleTodoSpec {
  return {
    userId: input.userId,
    categoryId: input.categoryId,
    title: TodoTitle.create(input.title),
    schedule: TodoSchedule.create({
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      scheduledLocalTime: input.scheduledTime ?? null,
      isAllDay: input.isAllDay ?? true,
      timezone: input.timezone,
    }),
    visibility: input.visibility ?? "PUBLIC",
  };
}

export interface CreatedTodo {
  readonly todo: Todo;
  /** 트랜잭션 안에서 반영한 사실. 옛 todo.* 이벤트로 커밋 뒤 다시 낸다. */
  readonly events: readonly TodoEvent[];
}

export interface WriteSingleTodoInput {
  readonly spec: SingleTodoSpec;
  readonly items?: readonly { title: string }[];
}

interface WriteSingleTodoDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "countCategoryUsage" | "getMaxSortOrder" | "nextId" | "insert" | "createInlineItems"
  >;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly clock: ClockPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
}

/** 단일 할 일을 저장한다. 활성 UoW와 생성 잠금 안에서 호출한다. */
export class WriteSingleTodoUseCase {
  readonly #dependencies: WriteSingleTodoDependencies;

  constructor(dependencies: WriteSingleTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: WriteSingleTodoInput): Promise<CreatedTodo> {
    const { spec, items } = input;
    const { todoRepository } = this.#dependencies;
    await this.#dependencies.categoryOwnership.validateOwnership(spec.categoryId, spec.userId);
    const activeCount = await todoRepository.countCategoryUsage(spec.userId, spec.categoryId);
    if (activeCount >= TODO_LIMITS.MAX_PER_CATEGORY) {
      throw categoryTodoLimitReached(activeCount);
    }
    const maxSortOrder = await todoRepository.getMaxSortOrder(spec.userId);
    const todo = Todo.create({
      id: await todoRepository.nextId(),
      userId: spec.userId,
      categoryId: spec.categoryId,
      title: spec.title,
      schedule: spec.schedule,
      visibility: spec.visibility,
      sortOrder: sortOrderAfterLast(maxSortOrder),
      now: this.#dependencies.clock.now(),
    });
    await todoRepository.insert(todo);
    if (items != null && items.length > 0) {
      await todoRepository.createInlineItems(todo.id, items);
    }
    // 리마인더 예약과 planning.todo.created는 행과 함께 커밋한다. 옛 todo.created는 커밋 뒤 따로 나간다
    const events = todo.pullDomainEvents();
    await this.#dependencies.applyTodoEvents.execute(events);
    return { todo, events };
  }
}
