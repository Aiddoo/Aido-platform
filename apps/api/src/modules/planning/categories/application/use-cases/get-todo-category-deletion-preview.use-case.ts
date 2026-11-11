import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import { todoCategoryNotFound } from "../categories.errors.js";
import type { TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";
import type { TodoCategoryDeletionPreviewReadModel } from "../read-models/todo-category-deletion.read-model.js";

export interface GetTodoCategoryDeletionPreviewInput {
  readonly userId: string;
  readonly categoryId: number;
}

interface GetTodoCategoryDeletionPreviewDependencies {
  readonly repository: Pick<
    TodoCategoryRepositoryPort,
    "findByIdAndUserId" | "countByUserId" | "countTodos" | "countActiveSeries"
  >;
}

/** 삭제 확인 화면이 고를 거리(할 일·완료·진행 중 반복 수)를 삭제와 같은 기준으로 읽는다. 잠그지 않는 조회다 */
export class GetTodoCategoryDeletionPreviewUseCase {
  readonly #dependencies: GetTodoCategoryDeletionPreviewDependencies;

  constructor(dependencies: GetTodoCategoryDeletionPreviewDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    input: GetTodoCategoryDeletionPreviewInput,
  ): Promise<TodoCategoryDeletionPreviewReadModel> {
    const { repository } = this.#dependencies;
    const userId = UserId.reconstitute(input.userId);
    const categoryId = TodoCategoryId.reconstitute(input.categoryId);
    const category = await repository.findByIdAndUserId(categoryId, userId);
    if (category == null) {
      throw todoCategoryNotFound(categoryId);
    }
    const todoCount = await repository.countTodos(userId, categoryId);
    return {
      categoryId: input.categoryId,
      todoCount: todoCount.total,
      completedTodoCount: todoCount.completed,
      activeSeriesCount: await repository.countActiveSeries(categoryId),
      isLastCategory: (await repository.countByUserId(userId)) <= 1,
    };
  }
}
