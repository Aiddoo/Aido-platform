import { ErrorCode } from "@aido/errors";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, EventBus, type ICommandHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/common/domain";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import { DeleteTodoCommand } from "./delete-todo.command";

/**
 * Todo 삭제 핸들러
 *
 * 소유권 확인 → 삭제(하위 항목 Cascade) → TodoDeletedEvent 발행(리마인더 취소) →
 * 캐시 무효화. 삭제이므로 응답 재조회 없음(void).
 */
@CommandHandler(DeleteTodoCommand)
export class DeleteTodoHandler implements ICommandHandler<DeleteTodoCommand> {
	readonly #logger = new Logger(DeleteTodoHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_CACHE)
		private readonly todoCache: TodoCachePort,
		private readonly eventBus: EventBus,
	) {}

	async execute(command: DeleteTodoCommand): Promise<void> {
		const { id, userId } = command;

		// 1. 소유권 확인
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);
		if (!todo) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}

		// 2. 삭제 (하위 항목은 Cascade)
		await this.todoRepository.delete(id);

		// 3. 삭제 완료 후 이벤트 발행 (이벤트 핸들러가 리마인더 취소)
		todo.markDeleted();
		this.eventBus.publishAll(todo.pullDomainEvents());

		// 4. 캐시 무효화 (todoCount 변경)
		await this.todoCache.invalidateTodoCategories(userId);

		this.#logger.log(`Todo deleted: ${id} for user: ${userId}`);
	}
}
