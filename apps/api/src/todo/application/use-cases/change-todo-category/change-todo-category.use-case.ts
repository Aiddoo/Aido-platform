import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { TODO_LIMITS } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";
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

/** Todo 카테고리 변경 입력. */
export interface ChangeTodoCategoryInput {
	id: number;
	userId: string;
	categoryId: number;
}

/**
 * Todo 카테고리 변경 use-case
 *
 * 소유권 확인 → 대상 카테고리 소유권 확인(TX 외부) →
 * 활성(미완료) 할 일이면 TX 안에서 한도 체크 후 이동(race 방지),
 * 완료된 할 일이면 TX 없이 이동 → 캐시 무효화 → 읽기 포트로 응답 재조회.
 */
@Injectable()
export class ChangeTodoCategoryUseCase {
	readonly #logger = new Logger(ChangeTodoCategoryUseCase.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		@Inject(CATEGORY_OWNERSHIP)
		private readonly categoryOwnership: CategoryOwnershipPort,
		@Inject(TODO_CACHE)
		private readonly todoCache: TodoCachePort,
	) {}

	async execute(input: ChangeTodoCategoryInput): Promise<TodoResponse> {
		const { id, userId, categoryId } = input;

		// 1. 대상 카테고리 소유권 확인 (읽기 전용, TX 외부)
		await this.categoryOwnership.validateOwnership(categoryId, userId);

		// 2. TX 안에서 로드 → 애그리게잇 전이 → 활성 할 일만 한도 체크 후 영속화 (race 방지)
		await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			todo.changeCategory(categoryId);
			const targetCategoryId = todo.toPersistence().categoryId;

			if (!todo.isCompleted()) {
				const activeInTarget = await this.todoRepository.countActiveByCategory(
					userId,
					categoryId,
				);
				if (activeInTarget >= TODO_LIMITS.MAX_PER_CATEGORY) {
					throw new ApplicationException(ErrorCode.TODO_0811, {
						activeCount: activeInTarget,
						maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
					});
				}
			}
			await this.todoRepository.updateCategory(id, targetCategoryId);
		});

		// 3. 캐시 무효화 (todoCount 변경)
		await this.todoCache.invalidateTodoCategories(userId);

		this.#logger.log(
			`Todo category updated: ${id} -> ${categoryId} for user: ${userId}`,
		);

		// 4. 응답 재조회
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
