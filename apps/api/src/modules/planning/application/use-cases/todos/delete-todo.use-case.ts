import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/** Todo 삭제 입력. */
export interface DeleteTodoInput {
  id: number;
  userId: string;
}

/**
 * Todo 삭제 use-case
 *
 * 소유권 확인 → 삭제(하위 항목 Cascade) → TodoDeletedEvent 발행(리마인더 취소) →
 * 캐시 무효화. 삭제이므로 응답 재조회 없음(void).
 */
interface DeleteTodoDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoCache: TodoCachePort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class DeleteTodo {
  readonly #dependencies: DeleteTodoDependencies;

  constructor(dependencies: DeleteTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoInput): Promise<void> {
    const { id, userId } = input;

    // TX 안에서 소유권 확인 → 삭제 (하위 항목은 Cascade)
    const events = await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      await this.#dependencies.todoRepository.delete(id);

      todo.markDeleted();
      return todo.pullDomainEvents();
    });

    // 삭제(TX 커밋) 완료 후 이벤트 발행 (이벤트 핸들러가 리마인더 취소)
    await this.#dependencies.eventPublisher.publishAll(events);

    // 캐시 무효화 (todoCount 변경 + 친구 공개 투두 첫 페이지)
    await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    this.#dependencies.logger.log(`Todo deleted: ${id} for user: ${userId}`);
  }
}
