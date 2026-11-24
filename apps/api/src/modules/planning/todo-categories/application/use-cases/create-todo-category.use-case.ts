import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { CategoryColor } from "../../domain/category-color.vo.js";
import { CategoryName } from "../../domain/category-name.vo.js";
import type { TodoCategory } from "../../domain/todo-category.aggregate.js";
import { type TodoCategoryCachePort } from "../ports/todo-category-cache.port.js";
import { TodoCategoryLockKeys } from "../todo-categories.lock-keys.js";
import { TodoCategoryLogEvent } from "../todo-categories.log-events.js";
import type { WriteTodoCategoryUseCase } from "./write-todo-category.use-case.js";

export interface CreateTodoCategoryInput {
  userId: string;
  name: string;
  color: string;
}

interface CreateTodoCategoryDependencies {
  readonly writeCategory: Pick<WriteTodoCategoryUseCase, "execute">;
  readonly cache: TodoCategoryCachePort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLoggerPort;
}

export class CreateTodoCategoryUseCase {
  readonly #dependencies: CreateTodoCategoryDependencies;

  constructor(dependencies: CreateTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateTodoCategoryInput): Promise<TodoCategory> {
    const userId = UserId.reconstitute(input.userId);
    const name = CategoryName.create(input.name);
    const color = CategoryColor.create(input.color);

    const [created] = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(input.userId),
      ]);
      return this.#dependencies.writeCategory.execute({ userId, drafts: [{ name, color }] });
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.debug({
      event: TodoCategoryLogEvent.CREATED,
      userId: input.userId,
      categoryId: created.id.value,
    });
    return created;
  }
}
