import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { Resource } from "#api/modules/access/access-entitlement.public";

import type { TodoCategoryRepositoryPort } from "../../ports/categories/todo-category.repository.port.js";

interface GetTodoCategoryResourceLimitDependencies {
  readonly repository: Pick<TodoCategoryRepositoryPort, "countByUserId">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getResourceLimit">;
}

export class GetTodoCategoryResourceLimit {
  readonly #dependencies: GetTodoCategoryResourceLimitDependencies;

  constructor(dependencies: GetTodoCategoryResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly userId: string;
  }): Promise<{ categoryCount: number; maxCount: number | null }> {
    const [entitlement, categoryCount] = await Promise.all([
      this.#dependencies.entitlementReader.getResourceLimit(input.userId, Resource.CATEGORY),
      this.#dependencies.repository.countByUserId(input.userId),
    ]);
    return { categoryCount, maxCount: entitlement.maxCount };
  }
}
