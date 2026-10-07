import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import type { TodoVisibility } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/** Todo 공개 범위 변경 입력. */
export interface UpdateTodoVisibilityInput {
  id: number;
  userId: string;
  visibility: TodoVisibility;
}

/**
 * Todo 공개 범위 변경 use-case
 *
 * 소유권 확인 → 애그리게잇 전이 → 애그리게잇 상태로 영속화 → 읽기 포트로 응답 재조회.
 * 커밋 후 이벤트를 발행해 공개 범위에 의존하는 크로스모듈 캐시를 무효화합니다.
 */
interface UpdateTodoVisibilityDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly todoCache: TodoCachePort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class UpdateTodoVisibility {
  readonly #dependencies: UpdateTodoVisibilityDependencies;

  constructor(dependencies: UpdateTodoVisibilityDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoVisibilityInput): Promise<TodoResponse> {
    const { id, userId, visibility } = input;

    // TX 안에서 로드 → 애그리게잇 전이 → 애그리게잇 상태로 영속화
    const events = await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      todo.changeVisibility(visibility);
      await this.#dependencies.todoRepository.updateVisibility(id, todo.toPersistence().visibility);
      return todo.pullDomainEvents();
    });

    this.#dependencies.logger.log(
      `Todo visibility updated: ${id} -> ${visibility} for user: ${userId}`,
    );

    // 저장(TX 커밋) 완료 후 이벤트 발행 (daily-completion 공개 캐시 무효화 트리거)
    await this.#dependencies.eventPublisher.publishAll(events);

    // 친구 공개 투두 캐시 무효화 (TX 커밋 후)
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    // 응답 재조회
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (!response) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
