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
import type { TodoVisibility } from "../../../domain/entities/todo.aggregate";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";

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
@Injectable()
export class UpdateTodoVisibilityUseCase {
	readonly #logger = new Logger(UpdateTodoVisibilityUseCase.name);

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

	async execute(input: UpdateTodoVisibilityInput): Promise<TodoResponse> {
		const { id, userId, visibility } = input;

		// TX 안에서 로드 → 애그리게잇 전이 → 애그리게잇 상태로 영속화
		const events = await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			todo.changeVisibility(visibility);
			await this.todoRepository.updateVisibility(
				id,
				todo.toPersistence().visibility,
			);
			return todo.pullDomainEvents();
		});

		this.#logger.log(
			`Todo visibility updated: ${id} -> ${visibility} for user: ${userId}`,
		);

		// 저장(TX 커밋) 완료 후 이벤트 발행 (daily-completion 공개 캐시 무효화 트리거)
		await this.eventPublisher.publishAll(events);

		// 친구 공개 투두 캐시 무효화 (TX 커밋 후)
		await this.todoCache.invalidateFriendTodos(userId);

		// 응답 재조회
		const response = await this.todoReadRepository.findByIdAndUserId(
			id,
			userId,
		);
		if (!response) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}
		return response;
	}
}
