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

/** Todo 완료 상태 토글 입력. */
export interface ToggleTodoCompleteInput {
  id: number;
  userId: string;
  completed: boolean;
  timezone: string;
}

/**
 * Todo 완료 상태 토글 use-case
 *
 * 애그리게잇을 로드해 완료 상태를 전이·영속화한 뒤 TodoToggledEvent를 발행하고,
 * 읽기 포트로 응답 read model을 조회해 반환합니다.
 * 스트릭·리마인더·친구 완료·마일스톤 부수효과는 이벤트 핸들러가 커밋 후 처리합니다.
 */
interface ToggleTodoCompleteDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly todoCache: TodoCachePort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class ToggleTodoComplete {
  readonly #dependencies: ToggleTodoCompleteDependencies;

  constructor(dependencies: ToggleTodoCompleteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ToggleTodoCompleteInput): Promise<TodoResponse> {
    const { id, userId, completed, timezone } = input;

    // TX 안에서 로드 → 전이 → 영속화 (동시 수정 레이스 창 축소)
    const events = await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      // 같은 값 재토글이면 쓰기·이벤트 생략 (스트릭/알림 재발화 억제, 응답은 동일)
      const changed = todo.toggleComplete(completed, timezone);
      if (!changed) {
        return [];
      }

      await this.#dependencies.todoRepository.updateCompletion(
        id,
        todo.isCompleted(),
        todo.getCompletedAt(),
      );

      this.#dependencies.logger.log(
        `Todo completion toggled: ${id} -> ${completed} for user: ${userId}`,
      );
      return todo.pullDomainEvents();
    });

    // 저장(TX 커밋) 완료 후 이벤트 발행 (부수효과는 이벤트 핸들러가 처리)
    await this.#dependencies.eventPublisher.publishAll(events);

    // 친구 공개 투두 캐시 무효화 (TX 커밋 후)
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (!response) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
