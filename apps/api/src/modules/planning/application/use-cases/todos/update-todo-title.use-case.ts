import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/** Todo 제목 수정 입력. */
export interface UpdateTodoTitleInput {
  id: number;
  userId: string;
  title: string;
}

/**
 * Todo 제목 수정 use-case
 *
 * 소유권 확인 → 애그리게잇 전이(TodoTitle 불변식 검증) → 애그리게잇 상태로 영속화 →
 * 이벤트 발행 → 읽기 포트로 응답 재조회.
 */
interface UpdateTodoTitleDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly todoCache: TodoCachePort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class UpdateTodoTitle {
  readonly #dependencies: UpdateTodoTitleDependencies;

  constructor(dependencies: UpdateTodoTitleDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoTitleInput): Promise<TodoResponse> {
    const { id, userId, title } = input;

    // TX 안에서 로드 → 애그리게잇 전이(제목 불변식) → 애그리게잇 상태로 영속화
    const events = await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      todo.updateDetails({ title });
      await this.#dependencies.todoRepository.updateTitle(id, todo.toPersistence().title);
      return todo.pullDomainEvents();
    });

    this.#dependencies.logger.log(`Todo title updated: ${id} for user: ${userId}`);

    // 저장(TX 커밋) 완료 후 이벤트 발행 (미완료 상태면 부수효과 없음)
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
