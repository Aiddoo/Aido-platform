import type { TodoCategoryLimitReaderPort } from "../ports/todo-category-limit.reader.port.js";
import type { TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";

interface GetTodoCategoryResourceLimitDependencies {
  readonly repository: Pick<TodoCategoryRepositoryPort, "countByUserId">;
  readonly limitReader: Pick<TodoCategoryLimitReaderPort, "readLimit">;
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
      this.#dependencies.limitReader.readLimit(input.userId),
      this.#dependencies.repository.countByUserId(input.userId),
    ]);
    return { categoryCount, maxCount };
  }
}
