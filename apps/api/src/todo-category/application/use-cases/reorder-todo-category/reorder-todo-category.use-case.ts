import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	MUTATION_LOCK,
	MutationLockKeys,
	type MutationLockPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import type { TodoCategory } from "../../../domain/entities/todo-category.aggregate";
import {
	planReorderRelativeTo,
	planReorderToEdge,
	type ReorderPosition,
} from "../../../domain/services/category-reorder";
import {
	TODO_CATEGORY_CACHE,
	type TodoCategoryCachePort,
} from "../../ports/todo-category-cache.port";
import {
	TODO_CATEGORY_REPOSITORY,
	type TodoCategoryRepositoryPort,
} from "../../ports/todo-category.repository.port";

export interface ReorderTodoCategoryInput {
	userId: string;
	categoryId: number;
	targetCategoryId?: number;
	position: ReorderPosition;
}

/**
 * 카테고리 재배치 use-case.
 *
 * 트랜잭션 안에서 이동 계획(사이 카테고리 시프트 + 새 순번)을 계산·적용한다. 자기 자신 대상이면 no-op.
 * 커밋 후 목록 캐시를 무효화한다.
 */
@Injectable()
export class ReorderTodoCategoryUseCase {
	readonly #logger = new Logger(ReorderTodoCategoryUseCase.name);

	constructor(
		@Inject(TODO_CATEGORY_REPOSITORY)
		private readonly repository: TodoCategoryRepositoryPort,
		@Inject(TODO_CATEGORY_CACHE)
		private readonly cache: TodoCategoryCachePort,
		@Inject(MUTATION_LOCK)
		private readonly mutationLock: MutationLockPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
	) {}

	async execute(input: ReorderTodoCategoryInput): Promise<TodoCategory> {
		const { userId, categoryId, targetCategoryId, position } = input;

		const result = await this.uow.run(async () => {
			await this.mutationLock.acquire([MutationLockKeys.todoCategory(userId)]);

			const category = await this.repository.findByIdAndUserId(categoryId, userId);
			if (!category) {
				throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
					categoryId,
				});
			}

			if (categoryId === targetCategoryId) {
				return category;
			}

			let plan: ReturnType<typeof planReorderRelativeTo>;
			if (targetCategoryId !== undefined) {
				const target = await this.repository.findByIdAndUserId(targetCategoryId, userId);
				if (!target) {
					throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
						categoryId: targetCategoryId,
					});
				}
				plan = planReorderRelativeTo(category.sortOrder, target.sortOrder, position);
			} else {
				const maxSortOrder = await this.repository.getMaxSortOrder(userId);
				plan = planReorderToEdge(category.sortOrder, position, maxSortOrder);
			}

			await this.repository.shiftSortOrders(
				userId,
				plan.shift.from,
				plan.shift.to,
				plan.shift.delta,
			);
			return this.repository.update(categoryId, {
				sortOrder: plan.newSortOrder,
			});
		});

		await this.cache.invalidate(userId);
		this.#logger.debug(`카테고리 재배치: id=${categoryId}, userId=${userId}`);
		return result;
	}
}
