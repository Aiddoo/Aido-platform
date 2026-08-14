import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import type { TodoCategory } from "../../../domain/entities/todo-category.aggregate";
import {
	TODO_CATEGORY_CACHE,
	type TodoCategoryCachePort,
} from "../../ports/todo-category-cache.port";
import {
	TODO_CATEGORY_REPOSITORY,
	type TodoCategoryRepositoryPort,
} from "../../ports/todo-category.repository.port";

export interface UpdateTodoCategoryInput {
	name?: string;
	color?: string;
}

/**
 * 카테고리 수정 use-case.
 * 소유 검증 후 이름 변경 시 중복을 확인하고 갱신한다. 목록 캐시를 무효화한다.
 */
@Injectable()
export class UpdateTodoCategoryUseCase {
	readonly #logger = new Logger(UpdateTodoCategoryUseCase.name);

	constructor(
		@Inject(TODO_CATEGORY_REPOSITORY)
		private readonly repository: TodoCategoryRepositoryPort,
		@Inject(TODO_CATEGORY_CACHE)
		private readonly cache: TodoCategoryCachePort,
	) {}

	async execute(id: number, userId: string, data: UpdateTodoCategoryInput): Promise<TodoCategory> {
		const category = await this.repository.findByIdAndUserId(id, userId);
		if (!category) {
			throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
				categoryId: id,
			});
		}

		if (data.name && data.name !== category.name) {
			const duplicate = await this.repository.existsByUserIdAndName(userId, data.name, id);
			if (duplicate) {
				throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
					name: data.name,
				});
			}
		}

		category.updateDetails(data);

		const updated = await this.repository.update(id, {
			name: data.name === undefined ? undefined : category.name,
			color: data.color === undefined ? undefined : category.color,
		});

		await this.cache.invalidate(userId);
		this.#logger.debug(`카테고리 수정: id=${id}, userId=${userId}`);
		return updated;
	}
}
