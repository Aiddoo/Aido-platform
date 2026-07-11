import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	TODO_CATEGORY_REPOSITORY,
	type TodoCategoryRepositoryPort,
} from "../../ports/todo-category.repository.port";
import {
	TODO_CATEGORY_CACHE,
	type TodoCategoryCachePort,
} from "../../ports/todo-category-cache.port";

export interface DeleteTodoCategoryInput {
	userId: string;
	categoryId: number;
	moveToCategoryId?: number;
}

/**
 * 카테고리 삭제 use-case.
 *
 * 트랜잭션 안에서 소유·최소개수(1개 이상 유지)·잔여 할 일을 검사하고, 할 일이 있으면 지정 카테고리로
 * 이동 후 삭제한다(Todo.category는 onDelete: Restrict). 커밋 후 목록 캐시를 무효화한다.
 */
@Injectable()
export class DeleteTodoCategoryUseCase {
	readonly #logger = new Logger(DeleteTodoCategoryUseCase.name);

	constructor(
		@Inject(TODO_CATEGORY_REPOSITORY)
		private readonly repository: TodoCategoryRepositoryPort,
		@Inject(TODO_CATEGORY_CACHE)
		private readonly cache: TodoCategoryCachePort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
	) {}

	async execute(input: DeleteTodoCategoryInput): Promise<void> {
		const { userId, categoryId, moveToCategoryId } = input;

		await this.uow.run(async () => {
			const category = await this.repository.findByIdAndUserId(
				categoryId,
				userId,
			);
			if (!category) {
				throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
					categoryId,
				});
			}

			const total = await this.repository.countByUserId(userId);
			if (total <= 1) {
				throw new ApplicationException(ErrorCode.TODO_CATEGORY_0854);
			}

			const todoCount = await this.repository.getTodoCount(categoryId);
			if (todoCount > 0) {
				if (!moveToCategoryId) {
					throw new ApplicationException(ErrorCode.TODO_CATEGORY_0855, {
						categoryId,
						todoCount,
					});
				}
				if (moveToCategoryId === categoryId) {
					throw new ApplicationException(ErrorCode.SYS_0002, {
						message: "삭제할 카테고리와 이동 대상 카테고리가 같을 수 없습니다",
						categoryId,
						moveToCategoryId,
					});
				}
				const moveTarget = await this.repository.findByIdAndUserId(
					moveToCategoryId,
					userId,
				);
				if (!moveTarget) {
					throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
						categoryId: moveToCategoryId,
					});
				}
				await this.repository.moveTodosToCategory(categoryId, moveToCategoryId);
			}

			await this.repository.delete(categoryId);
		});

		await this.cache.invalidate(userId);
		this.#logger.debug(`카테고리 삭제: id=${categoryId}, userId=${userId}`);
	}
}
