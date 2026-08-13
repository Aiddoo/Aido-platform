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
import {
	TODO_CATEGORY_LIMIT_READER,
	type TodoCategoryLimitReaderPort,
} from "../../ports/todo-category-limit-reader.port";

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
		@Inject(TODO_CATEGORY_LIMIT_READER)
		private readonly limitReader: TodoCategoryLimitReaderPort,
		@Inject(MUTATION_LOCK)
		private readonly mutationLock: MutationLockPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
	) {}

	async execute(input: CreateTodoCategoryInput): Promise<TodoCategory> {
		const { userId } = input;
		const name = CategoryName.of(input.name).value;
		const color = CategoryColor.of(input.color).value;

		const created = await this.uow.run(async () => {
			await this.mutationLock.acquire([MutationLockKeys.todoCategory(userId)]);

			const maxCount = await this.limitReader.getMaxCountInTx(userId);
			const categoryCount = await this.repository.countByUserId(userId);
			if (maxCount !== null && categoryCount >= maxCount) {
				throw new ApplicationException(ErrorCode.TODO_CATEGORY_0857, {
					current: categoryCount,
					limit: maxCount,
				});
			}

			if (await this.repository.existsByUserIdAndName(userId, name)) {
				throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
					name,
				});
			}

			const maxSortOrder = await this.repository.getMaxSortOrder(userId);
			return this.repository.create({
				userId,
				name,
				color,
				sortOrder: maxSortOrder + 1,
			});
		});

		await this.cache.invalidate(userId);
		this.#logger.debug(`카테고리 생성: id=${created.id}, userId=${userId}`);
		return created;
	}
}
