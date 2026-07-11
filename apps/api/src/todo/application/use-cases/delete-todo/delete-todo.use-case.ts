import { ErrorCode } from "@aido/errors";
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
@Injectable()
export class DeleteTodoUseCase {
	readonly #logger = new Logger(DeleteTodoUseCase.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_CACHE)
		private readonly todoCache: TodoCachePort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		@Inject(DOMAIN_EVENT_PUBLISHER)
		private readonly eventPublisher: DomainEventPublisherPort,
	) {}

	async execute(input: DeleteTodoInput): Promise<void> {
		const { id, userId } = input;

		// TX 안에서 소유권 확인 → 삭제 (하위 항목은 Cascade)
		const events = await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			await this.todoRepository.delete(id);

			todo.markDeleted();
			return todo.pullDomainEvents();
		});

		// 삭제(TX 커밋) 완료 후 이벤트 발행 (이벤트 핸들러가 리마인더 취소)
		this.eventPublisher.publishAll(events);

		// 캐시 무효화 (todoCount 변경 + 친구 공개 투두 첫 페이지)
		await this.todoCache.invalidateTodoCategories(userId);
		await this.todoCache.invalidateFriendTodos(userId);

		this.#logger.log(`Todo deleted: ${id} for user: ${userId}`);
	}
}
