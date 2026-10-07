import { randomUUID } from "node:crypto";

import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { RECURRING_TODO_LIMITS, TODO_LIMITS } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/index";

import { Todo, type TodoCreationPlan } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { expandRecurringDates } from "../../../domain/services/todos/expand-recurring-dates.js";
import type { CreateRecurringTodoData } from "../../models/todos/todo.types.js";
import { type CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

export interface CreateRecurringTodosResult {
  todos: TodoResponse[];
  count: number;
}

/** 반복 Todo 일괄 생성 입력. */
export interface CreateRecurringTodosInput {
  data: CreateRecurringTodoData;
  timezone: string;
}

/**
 * 반복 Todo 일괄 생성 use-case
 *
 * 날짜 확장(도메인 서비스) → 인스턴스 수 검증 → 카테고리 소유권 확인(TX 외부) →
 * TX 안에서 한도 체크·sortOrder 결정·일괄 생성 → 캐시 무효화 →
 * 인스턴스별 TodoCreatedEvent 발행(리마인더 스케줄링은 이벤트 핸들러) →
 * 읽기 포트로 그룹 재조회 후 반환.
 */
interface CreateRecurringTodosDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly categoryOwnership: CategoryOwnershipPort;
  readonly todoCache: TodoCachePort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class CreateRecurringTodos {
  readonly #dependencies: CreateRecurringTodosDependencies;

  constructor(dependencies: CreateRecurringTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateRecurringTodosInput): Promise<CreateRecurringTodosResult> {
    const { data, timezone } = input;

    // 생성 초안 — 생성 불변식(제목)·기본값 파생의 단일 지점 (도메인 팩토리)
    // 날짜·시간은 인스턴스별로 달라 확장 단계에서 덮어씁니다.
    const draft = Todo.planCreation({
      userId: data.userId,
      categoryId: data.categoryId,
      title: data.title,
      startDate: parseDateOnly(data.startDate),
      scheduledTime: null,
      isAllDay: data.isAllDay,
      visibility: data.visibility,
    });

    // 1. 날짜 확장 (요일 매칭, 도메인 서비스)
    const matchingDates = expandRecurringDates(data.startDate, data.endDate, data.daysOfWeek);
    const todoCount = matchingDates.length;

    // 2. 인스턴스 수 검증
    if (todoCount === 0) {
      throw new ApplicationException(ErrorCode.SYS_0002, {
        message: "선택한 기간과 요일에 해당하는 날짜가 없습니다",
        startDate: data.startDate,
        endDate: data.endDate,
        daysOfWeek: data.daysOfWeek,
      });
    }
    if (todoCount > RECURRING_TODO_LIMITS.MAX_INSTANCES) {
      throw new ApplicationException(ErrorCode.TODO_0812, {
        count: todoCount,
        limit: RECURRING_TODO_LIMITS.MAX_INSTANCES,
      });
    }

    // 3. 카테고리 소유권 확인 (읽기 전용, TX 외부)
    await this.#dependencies.categoryOwnership.validateOwnership(data.categoryId, data.userId);

    // 4. TX 안에서 한도 체크 + sortOrder 결정 + 일괄 생성 (race condition 방지)
    const recurrenceGroupId = randomUUID();

    const created = await this.#dependencies.unitOfWork.run(async () => {
      const activeInCategory = await this.#dependencies.todoRepository.countActiveByCategory(
        data.userId,
        data.categoryId,
      );
      if (activeInCategory + todoCount > TODO_LIMITS.MAX_PER_CATEGORY) {
        throw new ApplicationException(ErrorCode.TODO_0813, {
          activeInCategory,
          batchSize: todoCount,
          maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
        });
      }

      const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(data.userId);

      const items: TodoCreationPlan[] = matchingDates.map((dateStr, index) => ({
        ...draft,
        sortOrder: maxSortOrder + 1 + index,
        startDate: parseDateOnly(dateStr),
        scheduledTime: data.scheduledTime
          ? parseLocalDateTime(dateStr, data.scheduledTime, timezone)
          : null,
      }));

      const todos = await this.#dependencies.todoRepository.createMany(items, recurrenceGroupId);
      if (data.items?.length) {
        for (const todo of todos) {
          await this.#dependencies.todoRepository.createInlineItems(
            todo.getId().getValue(),
            data.items,
          );
        }
      }
      return todos;
    });

    this.#dependencies.logger.log(
      `Recurring todos created: ${todoCount} items, group: ${recurrenceGroupId}, user: ${data.userId}`,
    );

    // 5. 캐시 무효화 (todoCount 변경 — 단건 create와 동일 규칙)
    await this.#dependencies.todoCache.invalidateTodoCategories(data.userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(data.userId);

    // 6. 저장 완료 후 이벤트 일괄 발행 (인스턴스 순서 보존 · 리마인더 스케줄링은 이벤트 핸들러)
    const domainEvents = created.flatMap((todo) => {
      todo.markCreated();
      return todo.pullDomainEvents();
    });
    await this.#dependencies.eventPublisher.publishAll(domainEvents);

    // 7. 그룹 재조회 (sortOrder asc — 생성 순서와 동일)
    const todos = await this.#dependencies.todoReadRepository.findManyByRecurrenceGroupId(
      data.userId,
      recurrenceGroupId,
    );

    return { todos, count: todoCount };
  }
}
