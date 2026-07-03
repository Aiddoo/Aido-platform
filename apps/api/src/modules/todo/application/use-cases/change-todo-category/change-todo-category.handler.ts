import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { TODO_LIMITS } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import {
	TRANSACTION_MANAGER,
	type TransactionManagerPort,
} from "@/common/database";
import { ApplicationException } from "@/common/domain";
import {
	CATEGORY_OWNERSHIP,
	type CategoryOwnershipPort,
} from "../../ports/category-ownership.port";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { ChangeTodoCategoryCommand } from "./change-todo-category.command";

/**
 * Todo 카테고리 변경 핸들러
 *
 * 소유권 확인 → 대상 카테고리 소유권 확인(TX 외부) →
 * 활성(미완료) 할 일이면 TX 안에서 한도 체크 후 이동(race 방지),
 * 완료된 할 일이면 TX 없이 이동 → 캐시 무효화 → 읽기 포트로 응답 재조회.
 */
@CommandHandler(ChangeTodoCategoryCommand)
export class ChangeTodoCategoryHandler
	implements ICommandHandler<ChangeTodoCategoryCommand, TodoResponse>
{
	readonly #logger = new Logger(ChangeTodoCategoryHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(TRANSACTION_MANAGER)
		private readonly txManager: TransactionManagerPort,
		@Inject(CATEGORY_OWNERSHIP)
		private readonly categoryOwnership: CategoryOwnershipPort,
		@Inject(TODO_CACHE)
		private readonly todoCache: TodoCachePort,
	) {}

	async execute(command: ChangeTodoCategoryCommand): Promise<TodoResponse> {
		const { id, userId, categoryId } = command;

		// 1. 소유권 확인
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);
		if (!todo) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}

		// 2. 대상 카테고리 소유권 확인 (읽기 전용, TX 외부)
		await this.categoryOwnership.validateOwnership(categoryId, userId);

		// 3. 카테고리 이동 — 활성 할 일만 TX 안에서 한도 체크 (race condition 방지)
		if (todo.isCompleted()) {
			await this.todoRepository.updateCategory(id, categoryId);
		} else {
			await this.txManager.run(async (tx) => {
				const activeInTarget = await this.todoRepository.countActiveByCategory(
					userId,
					categoryId,
					tx,
				);
				if (activeInTarget >= TODO_LIMITS.MAX_PER_CATEGORY) {
					throw new ApplicationException(ErrorCode.TODO_0811, {
						activeCount: activeInTarget,
						maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
					});
				}
				await this.todoRepository.updateCategory(id, categoryId, tx);
			});
		}

		// 4. 캐시 무효화 (todoCount 변경)
		await this.todoCache.invalidateTodoCategories(userId);

		this.#logger.log(
			`Todo category updated: ${id} -> ${categoryId} for user: ${userId}`,
		);

		// 5. 응답 재조회
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
