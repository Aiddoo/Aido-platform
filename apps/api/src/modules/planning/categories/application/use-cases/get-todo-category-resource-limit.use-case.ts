import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";

import type { TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";

interface GetTodoCategoryResourceLimitDependencies {
  readonly repository: Pick<TodoCategoryRepositoryPort, "countByUserId">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getLimit">;
}

export class GetTodoCategoryResourceLimitUseCase {
  readonly #dependencies: GetTodoCategoryResourceLimitDependencies;

  constructor(dependencies: GetTodoCategoryResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly userId: string;
  }): Promise<{ categoryCount: number; maxCount: number | null }> {
    const [maxCount, categoryCount] = await Promise.all([
      this.#dependencies.entitlementReader.getLimit(input.userId, "TODO_CATEGORY"),
      this.#dependencies.repository.countByUserId(input.userId),
    ]);
    return { categoryCount, maxCount };
  }
}
