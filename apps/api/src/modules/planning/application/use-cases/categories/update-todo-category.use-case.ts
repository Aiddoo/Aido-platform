import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";
import { PlanningCategoryLogEvent } from "../../observability/categories/planning-category-log.events.js";
import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { type TodoCategoryRepositoryPort } from "../../ports/categories/todo-category.repository.port.js";

export interface UpdateTodoCategoryData {
  name?: string;
  color?: string;
}

export interface UpdateTodoCategoryInput {
  readonly id: number;
  readonly userId: string;
  readonly data: UpdateTodoCategoryData;
}

interface UpdateTodoCategoryDependencies {
  readonly repository: Pick<
    TodoCategoryRepositoryPort,
    "findByIdAndUserId" | "existsByUserIdAndName" | "update"
  >;
  readonly cache: TodoCategoryCachePort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class UpdateTodoCategory {
  readonly #dependencies: UpdateTodoCategoryDependencies;

  constructor(dependencies: UpdateTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoCategoryInput): Promise<TodoCategory> {
    const { id, userId, data } = input;
    const updated = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todoCategory(userId)]);
      const category = await this.#dependencies.repository.findByIdAndUserId(id, userId);
      if (category === null) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
          categoryId: id,
        });
      }

      if (data.name !== undefined && data.name !== category.name) {
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

      return this.#dependencies.repository.update(id, {
        name: data.name === undefined ? undefined : category.name,
        color: data.color === undefined ? undefined : category.color,
      });
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.debug({
      event: PlanningCategoryLogEvent.UPDATED,
      userId,
      categoryId: id,
    });
    return updated;
  }
}
