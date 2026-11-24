import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CategoryColor } from "../../domain/category-color.vo.js";
import type { CategoryName } from "../../domain/category-name.vo.js";
import { TodoCategory } from "../../domain/todo-category.aggregate.js";
import type { TodoCategoryLimitReaderPort } from "../ports/todo-category-limit.reader.port.js";
import type { TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";
import { duplicateCategoryName, todoCategoryLimitReached } from "../todo-categories.errors.js";

export interface TodoCategoryDraft {
  readonly name: CategoryName;
  readonly color: CategoryColor;
}

export type NonEmptyList<TItem> = readonly [TItem, ...TItem[]];

export interface WriteTodoCategoryCommand {
  readonly userId: UserId;
  readonly drafts: NonEmptyList<TodoCategoryDraft>;
}

interface CategoryPlacement {
  readonly userId: UserId;
  readonly firstSortOrder: number;
  readonly index: number;
  readonly now: Temporal.Instant;
}

interface WriteTodoCategoryDependencies {
  readonly repository: Pick<
    TodoCategoryRepositoryPort,
    "countByUserId" | "listNamesByUserId" | "getMaxSortOrder" | "nextId" | "insert"
  >;
  readonly limitReader: Pick<
    TodoCategoryLimitReaderPort,
    "readLimitInTransaction" | "readFeatureQuotaInTransaction"
  >;
  readonly clock: ClockPort;
}

// 직접 만들기와 가져오기가 같은 한도·이름 규칙으로 카테고리를 쓴다. 사용자 카테고리 잠금을 쥔 UoW 안에서 부른다
export class WriteTodoCategoryUseCase {
  readonly #dependencies: WriteTodoCategoryDependencies;

  constructor(dependencies: WriteTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: WriteTodoCategoryCommand): Promise<NonEmptyList<TodoCategory>> {
    const { userId, drafts } = command;
    await this.#assertWithinLimit(userId, drafts.length);
    await this.#assertNamesAvailable(userId, drafts);
    const placement = {
      userId,
      firstSortOrder: (await this.#dependencies.repository.getMaxSortOrder(userId)) + 1,
      now: this.#dependencies.clock.now(),
    };
    const [first, ...rest] = drafts;
    const firstCategory = await this.#insert(first, { ...placement, index: 0 });
    const restCategories: TodoCategory[] = [];
    for (const [index, draft] of rest.entries()) {
      restCategories.push(await this.#insert(draft, { ...placement, index: index + 1 }));
    }
    return [firstCategory, ...restCategories];
  }

  async #insert(draft: TodoCategoryDraft, placement: CategoryPlacement): Promise<TodoCategory> {
    const { repository } = this.#dependencies;
    const category = TodoCategory.create({
      id: await repository.nextId(),
      userId: placement.userId,
      name: draft.name,
      color: draft.color,
      sortOrder: placement.firstSortOrder + placement.index,
      now: placement.now,
    });
    await repository.insert(category);
    return category;
  }

  async #assertWithinLimit(userId: UserId, addedCount: number): Promise<void> {
    const { repository, limitReader } = this.#dependencies;
    const maxCount = await limitReader.readLimitInTransaction(userId);
    const categoryCount = await repository.countByUserId(userId);
    if (maxCount != null && categoryCount + addedCount > maxCount) {
      throw todoCategoryLimitReached(
        await limitReader.readFeatureQuotaInTransaction(userId, categoryCount),
      );
    }
  }

  async #assertNamesAvailable(userId: UserId, drafts: readonly TodoCategoryDraft[]): Promise<void> {
    const takenNames = new Set(await this.#dependencies.repository.listNamesByUserId(userId));
    for (const { name } of drafts) {
      if (takenNames.has(name.value)) {
        throw duplicateCategoryName(name.value);
      }
      takenNames.add(name.value);
    }
  }
}
