import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import {
  TodoSchedule,
  type TodoScheduleProps,
} from "../../../domain/value-objects/todos/todo-schedule.vo.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/**
 * 일정 변경 입력
 *
 * 날짜/시간 문자열 파싱(X-Timezone 반영)은 컨트롤러가 담당하고,
 * 입력은 파싱 완료된 Date 값만 운반합니다.
 */
export interface UpdateTodoScheduleInput {
  id: number;
  userId: string;
  schedule: TodoScheduleProps;
}

/**
 * Todo 일정 변경 use-case
 *
 * 소유권 확인 → TodoSchedule VO로 일정 전이·영속화 →
 * TodoRescheduledEvent 발행(리마인더 재스케줄/취소는 이벤트 핸들러) →
 * 읽기 포트로 응답 재조회.
 */
interface UpdateTodoScheduleDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly todoCache: TodoCachePort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class UpdateTodoSchedule {
  readonly #dependencies: UpdateTodoScheduleDependencies;

  constructor(dependencies: UpdateTodoScheduleDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoScheduleInput): Promise<TodoResponse> {
    const { id, userId, schedule } = input;

    // TX 안에서 로드 → 일정 전이(VO가 날짜 불변식 보장) → 애그리게잇 상태로 영속화
    const events = await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      todo.reschedule(TodoSchedule.create(schedule));

      const snapshot = todo.toPersistence();
      await this.#dependencies.todoRepository.updateSchedule(id, {
        startDate: snapshot.startDate,
        endDate: snapshot.endDate,
        scheduledTime: snapshot.scheduledTime,
        isAllDay: snapshot.isAllDay,
      });
      return todo.pullDomainEvents();
    });

    this.#dependencies.logger.log(`Todo schedule updated: ${id} for user: ${userId}`);

    // 저장(TX 커밋) 완료 후 이벤트 발행 (리마인더 재스케줄/취소는 이벤트 핸들러)
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
