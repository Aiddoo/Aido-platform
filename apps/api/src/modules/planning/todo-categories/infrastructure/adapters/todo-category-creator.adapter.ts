import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryCachePort } from "../../application/ports/todo-category-cache.port.js";
import type {
  TodoCategoryCreationDraft,
  TodoCategoryCreatorPort,
} from "../../application/ports/todo-category-creator.port.js";
import type {
  NonEmptyList,
  TodoCategoryDraft,
  WriteTodoCategoryUseCase,
} from "../../application/use-cases/write-todo-category.use-case.js";
import { CategoryColor } from "../../domain/category-color.vo.js";
import { CategoryName } from "../../domain/category-name.vo.js";
import type { TodoCategoryId } from "../../domain/todo-category-id.vo.js";

interface TodoCategoryCreatorDependencies {
  readonly writeCategory: Pick<WriteTodoCategoryUseCase, "execute">;
  readonly cache: Pick<TodoCategoryCachePort, "invalidate">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
}

function isNonEmpty<TItem>(items: readonly TItem[]): items is NonEmptyList<TItem> {
  return items.length > 0;
}

function toCategoryDraft(draft: TodoCategoryCreationDraft): TodoCategoryDraft {
  return { name: CategoryName.create(draft.name), color: CategoryColor.create(draft.color) };
}

export class TodoCategoryCreatorAdapter implements TodoCategoryCreatorPort {
  readonly #dependencies: TodoCategoryCreatorDependencies;

  constructor(dependencies: TodoCategoryCreatorDependencies) {
    this.#dependencies = dependencies;
  }

  async createMany(
    userId: UserId,
    drafts: readonly TodoCategoryCreationDraft[],
  ): Promise<readonly TodoCategoryId[]> {
    if (!isNonEmpty(drafts)) {
      return [];
    }
    const [first, ...rest] = drafts;
    const categories = await this.#dependencies.writeCategory.execute({
      userId,
      drafts: [toCategoryDraft(first), ...rest.map(toCategoryDraft)],
    });
    const { cache, afterCommit } = this.#dependencies;
    afterCommit.register(() => cache.invalidate(userId), `todo-categories:${userId.value}`);
    return categories.map((category) => category.id);
  }
}
