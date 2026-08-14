import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	DOMAIN_EVENT_PUBLISHER,
	type DomainEventPublisherPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";

import {
	TodoSchedule,
	type TodoScheduleProps,
} from "../../../domain/value-objects/todo-schedule.vo";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { TODO_REPOSITORY, type TodoRepositoryPort } from "../../ports/todo.repository.port";

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
@Injectable()
export class UpdateTodoScheduleUseCase {
	readonly #logger = new Logger(UpdateTodoScheduleUseCase.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		@Inject(TODO_CACHE)
		private readonly todoCache: TodoCachePort,
		@Inject(DOMAIN_EVENT_PUBLISHER)
		private readonly eventPublisher: DomainEventPublisherPort,
	) {}

	async execute(input: UpdateTodoScheduleInput): Promise<TodoResponse> {
		const { id, userId, schedule } = input;

		// TX 안에서 로드 → 일정 전이(VO가 날짜 불변식 보장) → 애그리게잇 상태로 영속화
		const events = await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			todo.reschedule(TodoSchedule.create(schedule));

			const snapshot = todo.toPersistence();
			await this.todoRepository.updateSchedule(id, {
				startDate: snapshot.startDate,
				endDate: snapshot.endDate,
				scheduledTime: snapshot.scheduledTime,
				isAllDay: snapshot.isAllDay,
			});
			return todo.pullDomainEvents();
		});

		this.#logger.log(`Todo schedule updated: ${id} for user: ${userId}`);

		// 저장(TX 커밋) 완료 후 이벤트 발행 (리마인더 재스케줄/취소는 이벤트 핸들러)
		await this.eventPublisher.publishAll(events);

		// 친구 공개 투두 캐시 무효화 (TX 커밋 후)
		await this.todoCache.invalidateFriendTodos(userId);

		// 응답 재조회
		const response = await this.todoReadRepository.findByIdAndUserId(id, userId);
		if (!response) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}
		return response;
	}
}
