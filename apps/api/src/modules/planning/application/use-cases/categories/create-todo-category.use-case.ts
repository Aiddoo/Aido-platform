import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";
import { CategoryColor } from "../../../domain/value-objects/categories/category-color.vo.js";
import { CategoryName } from "../../../domain/value-objects/categories/category-name.vo.js";
import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { type TodoCategoryLimitReaderPort } from "../../ports/categories/todo-category-limit-reader.port.js";
import { type TodoCategoryRepositoryPort } from "../../ports/categories/todo-category.repository.port.js";

export interface CreateTodoCategoryInput {
  userId: string;
  name: string;
  color: string;
}

/**
 * 카테고리 생성 use-case.
 * 자원 한도·이름 중복을 검사한 뒤 맨 뒤 순번으로 생성하고 목록 캐시를 무효화한다.
 */
interface CreateTodoCategoryDependencies {
  readonly repository: TodoCategoryRepositoryPort;
  readonly cache: TodoCategoryCachePort;
  readonly limitReader: TodoCategoryLimitReaderPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class CreateTodoCategory {
  readonly #dependencies: CreateTodoCategoryDependencies;

  constructor(dependencies: CreateTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateTodoCategoryInput): Promise<TodoCategory> {
    const { userId } = input;
    const name = CategoryName.of(input.name).value;
    const color = CategoryColor.of(input.color).value;

    const created = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todoCategory(userId)]);

      const maxCount = await this.#dependencies.limitReader.getMaxCountInTx(userId);
      const categoryCount = await this.#dependencies.repository.countByUserId(userId);
      if (maxCount !== null && categoryCount >= maxCount) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0857, {
          current: categoryCount,
          limit: maxCount,
        });
      }

      if (await this.#dependencies.repository.existsByUserIdAndName(userId, name)) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
          name,
        });
      }

      const maxSortOrder = await this.#dependencies.repository.getMaxSortOrder(userId);
      return this.#dependencies.repository.create({
        userId,
        name,
        color,
        sortOrder: maxSortOrder + 1,
      });
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.debug(`카테고리 생성: id=${created.id}, userId=${userId}`);
    return created;
  }
}
