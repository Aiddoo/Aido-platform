import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { CategoryColor } from "../../domain/category-color.vo.js";
import { CategoryName } from "../../domain/category-name.vo.js";
import { TodoCategory } from "../../domain/todo-category.aggregate.js";
import { TodoCategoryLockKeys } from "../categories.lock-keys.js";
import { TodoCategoryLogEvent } from "../categories.log-events.js";
import { type TodoCategoryCachePort } from "../ports/todo-category-cache.port.js";
import { type TodoCategoryLimitReaderPort } from "../ports/todo-category-limit.reader.port.js";
import { type TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";

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
  readonly repository: Pick<
    TodoCategoryRepositoryPort,
    "countByUserId" | "existsByUserIdAndName" | "getMaxSortOrder" | "nextId" | "insert"
  >;
  readonly cache: TodoCategoryCachePort;
  readonly limitReader: TodoCategoryLimitReaderPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class CreateTodoCategoryUseCase {
  readonly #dependencies: CreateTodoCategoryDependencies;

  constructor(dependencies: CreateTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateTodoCategoryInput): Promise<TodoCategory> {
    const { userId } = input;
    const name = CategoryName.create(input.name);
    const color = CategoryColor.create(input.color);

    const created = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([TodoCategoryLockKeys.userCategories(userId)]);

      const maxCount = await this.#dependencies.limitReader.getMaxCountInTx(userId);
      const categoryCount = await this.#dependencies.repository.countByUserId(userId);
      if (maxCount != null && categoryCount >= maxCount) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0857, {
          charged: false,
          featureQuota: await this.#dependencies.limitReader.readQuotaInTx(userId, categoryCount),
        });
      }

      const { repository } = this.#dependencies;
      if (await repository.existsByUserIdAndName(userId, name.value)) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
          name: name.value,
        });
      }

      const maxSortOrder = await repository.getMaxSortOrder(userId);
      const category = TodoCategory.create({
        id: await repository.nextId(),
        userId: UserId.reconstitute(userId),
        name,
        color,
        sortOrder: maxSortOrder + 1,
        now: this.#dependencies.clock.now(),
      });
      await repository.insert(category);
      return category;
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.debug({
      event: TodoCategoryLogEvent.CREATED,
      userId,
      categoryId: created.id.value,
    });
    return created;
  }
}
