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
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";

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
@Injectable()
export class UpdateTodoTitleUseCase {
	readonly #logger = new Logger(UpdateTodoTitleUseCase.name);

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

	async execute(input: UpdateTodoTitleInput): Promise<TodoResponse> {
		const { id, userId, title } = input;

		// TX 안에서 로드 → 애그리게잇 전이(제목 불변식) → 애그리게잇 상태로 영속화
		const events = await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			todo.updateDetails({ title });
			await this.todoRepository.updateTitle(id, todo.toPersistence().title);
			return todo.pullDomainEvents();
		});

		this.#logger.log(`Todo title updated: ${id} for user: ${userId}`);

		// 저장(TX 커밋) 완료 후 이벤트 발행 (미완료 상태면 부수효과 없음)
		this.eventPublisher.publishAll(events);

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
