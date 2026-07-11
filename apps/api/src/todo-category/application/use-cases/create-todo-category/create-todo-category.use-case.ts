import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	EntitlementService,
	Resource,
} from "@/shared/application/entitlement/entitlement.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import type { TodoCategory } from "../../../domain/entities/todo-category.entity";
import { CategoryColor } from "../../../domain/value-objects/category-color.vo";
import { CategoryName } from "../../../domain/value-objects/category-name.vo";
import {
	TODO_CATEGORY_REPOSITORY,
	type TodoCategoryRepositoryPort,
} from "../../ports/todo-category.repository.port";
import {
	TODO_CATEGORY_CACHE,
	type TodoCategoryCachePort,
} from "../../ports/todo-category-cache.port";

export interface CreateTodoCategoryInput {
	userId: string;
	name: string;
	color: string;
}

/**
 * 카테고리 생성 use-case.
 * 자원 한도·이름 중복을 검사한 뒤 맨 뒤 순번으로 생성하고 목록 캐시를 무효화한다.
 */
@Injectable()
export class CreateTodoCategoryUseCase {
	readonly #logger = new Logger(CreateTodoCategoryUseCase.name);

	constructor(
		@Inject(TODO_CATEGORY_REPOSITORY)
		private readonly repository: TodoCategoryRepositoryPort,
		@Inject(TODO_CATEGORY_CACHE)
		private readonly cache: TodoCategoryCachePort,
		private readonly entitlementService: EntitlementService,
	) {}

	async execute(input: CreateTodoCategoryInput): Promise<TodoCategory> {
		const { userId } = input;
		const name = CategoryName.of(input.name).value;
		const color = CategoryColor.of(input.color).value;

		const [entitlement, categoryCount] = await Promise.all([
			this.entitlementService.getResourceLimit(userId, Resource.CATEGORY),
			this.repository.countByUserId(userId),
		]);
		if (
			entitlement.maxCount !== null &&
			categoryCount >= entitlement.maxCount
		) {
			throw new ApplicationException(ErrorCode.TODO_CATEGORY_0857, {
				current: categoryCount,
				limit: entitlement.maxCount,
			});
		}

		if (await this.repository.existsByUserIdAndName(userId, name)) {
			throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, { name });
		}

		const maxSortOrder = await this.repository.getMaxSortOrder(userId);
		const created = await this.repository.create({
			userId,
			name,
			color,
			sortOrder: maxSortOrder + 1,
		});

		await this.cache.invalidate(userId);
		this.#logger.debug(`카테고리 생성: id=${created.id}, userId=${userId}`);
		return created;
	}
}
