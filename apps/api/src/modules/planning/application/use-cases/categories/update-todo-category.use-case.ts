import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";
import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { type TodoCategoryRepositoryPort } from "../../ports/categories/todo-category.repository.port.js";

export interface UpdateTodoCategoryInput {
  name?: string;
  color?: string;
}

/**
 * 카테고리 수정 use-case.
 * 소유 검증 후 이름 변경 시 중복을 확인하고 갱신한다. 목록 캐시를 무효화한다.
 */
interface UpdateTodoCategoryDependencies {
  readonly repository: TodoCategoryRepositoryPort;
  readonly cache: TodoCategoryCachePort;
  readonly logger: ApplicationLogger;
}

export class UpdateTodoCategory {
  readonly #dependencies: UpdateTodoCategoryDependencies;

  constructor(dependencies: UpdateTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(id: number, userId: string, data: UpdateTodoCategoryInput): Promise<TodoCategory> {
    const category = await this.#dependencies.repository.findByIdAndUserId(id, userId);
    if (!category) {
      throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
        categoryId: id,
      });
    }

    if (data.name && data.name !== category.name) {
      const duplicate = await this.#dependencies.repository.existsByUserIdAndName(
        userId,
        data.name,
        id,
      );
      if (duplicate) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
          name: data.name,
        });
      }
    }

    category.updateDetails(data);

    const updated = await this.#dependencies.repository.update(id, {
      name: data.name === undefined ? undefined : category.name,
      color: data.color === undefined ? undefined : category.color,
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.debug(`카테고리 수정: id=${id}, userId=${userId}`);
    return updated;
  }
}
