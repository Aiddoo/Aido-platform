import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { Todo } from "../../../domain/aggregates/todos/todo.aggregate.js";
import type { CreateTodoData } from "../../models/todos/todo.types.js";
import { type CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/** Todo 생성 입력. */
export type CreateTodoInput = CreateTodoData;

/**
 * Todo 생성 use-case
 *
 * 카테고리 소유권 확인(TX 외부) → 트랜잭션 내 한도 체크·sortOrder 결정·생성·인라인 항목 →
 * 캐시 무효화 → TodoCreatedEvent 발행(리마인더 스케줄링은 이벤트 핸들러) →
 * 읽기 포트로 응답 read model 조회 후 반환.
 */
interface CreateTodoDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly categoryOwnership: CategoryOwnershipPort;
  readonly todoCache: TodoCachePort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class CreateTodo {
  readonly #dependencies: CreateTodoDependencies;

  constructor(dependencies: CreateTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateTodoInput): Promise<TodoResponse> {
    const data = input;

    // 생성 초안 — 생성 불변식(제목)·기본값 파생의 단일 지점 (도메인 팩토리)
    const draft = Todo.planCreation({
      userId: data.userId,
      categoryId: data.categoryId,
      title: data.title,
      startDate: data.startDate,
      endDate: data.endDate,
      scheduledTime: data.scheduledTime,
      isAllDay: data.isAllDay,
      visibility: data.visibility,
    });

    // 카테고리 존재 및 소유권 확인 (읽기 전용, TX 외부)
    await this.#dependencies.categoryOwnership.validateOwnership(data.categoryId, data.userId);

    // TX 내에서 제한 체크 + sortOrder 결정 + 생성 (race condition 방지)
    const created = await this.#dependencies.unitOfWork.run(async () => {
      const activeInCategory = await this.#dependencies.todoRepository.countActiveByCategory(
        data.userId,
        data.categoryId,
      );
      if (activeInCategory >= TODO_LIMITS.MAX_PER_CATEGORY) {
        throw new ApplicationException(ErrorCode.TODO_0811, {
          activeCount: activeInCategory,
          maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
        });
      }

      const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(data.userId);

      const todo = await this.#dependencies.todoRepository.create({
        ...draft,
        sortOrder: maxSortOrder + 1,
      });

      if (data.items?.length) {
        await this.#dependencies.todoRepository.createInlineItems(
          todo.getId().getValue(),
          data.items,
        );
      }

      return todo;
    });

    this.#dependencies.logger.log(
      `Todo created: ${created.getId().getValue()} for user: ${data.userId}`,
    );

    await this.#dependencies.todoCache.invalidateTodoCategories(data.userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(data.userId);

    // 생성 이벤트 발행(TX 커밋 후) → 리마인더 스케줄링은 이벤트 핸들러가 처리
    created.markCreated();
    await this.#dependencies.eventPublisher.publishAll(created.pullDomainEvents());

    // 응답 read model 조회 (카테고리·itemStats 포함)
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      created.getId().getValue(),
      data.userId,
    );
    if (!response) {
      throw new ApplicationException(ErrorCode.TODO_0801, {
        todoId: created.getId().getValue(),
      });
    }
    return response;
  }
}
