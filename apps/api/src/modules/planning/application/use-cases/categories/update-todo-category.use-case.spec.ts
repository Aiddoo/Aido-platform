import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";
import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { type TodoCategoryRepositoryPort } from "../../ports/categories/todo-category.repository.port.js";
import { UpdateTodoCategory } from "./update-todo-category.use-case.js";

const createExistingCategory = () =>
  TodoCategory.reconstitute({
    id: 1,
    userId: "u1",
    name: "기존",
    color: "#FFB3B3",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe("UpdateTodoCategory", () => {
  let useCase: UpdateTodoCategory;
  let repo: Mocked<TodoCategoryRepositoryPort>;
  let cache: Mocked<TodoCategoryCachePort>;

  beforeEach(async () => {
    const updateTodoCategoryDependencies = mockDeep<
      ConstructorParameters<typeof UpdateTodoCategory>[0]
    >({});
    const unit = new UpdateTodoCategory(updateTodoCategoryDependencies);
    useCase = unit;
    repo = updateTodoCategoryDependencies.repository;
    cache = updateTodoCategoryDependencies.cache;

    const existing = createExistingCategory();
    repo.findByIdAndUserId.mockResolvedValue(existing);
    repo.existsByUserIdAndName.mockResolvedValue(false);
    repo.update.mockResolvedValue(
      TodoCategory.reconstitute({
        ...existing,
        id: 1,
        userId: "u1",
        name: "수정",
        color: "#FF0000",
        sortOrder: 0,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      }),
    );
  });

  it("존재하지 않으면 TODO_CATEGORY_0851", async () => {
    repo.findByIdAndUserId.mockResolvedValue(null);
    await expect(useCase.execute(1, "u1", { name: "수정" })).rejects.toBeInstanceOf(
      ApplicationException,
    );
  });

  it("이름 변경 시 중복이면 TODO_CATEGORY_0853", async () => {
    repo.existsByUserIdAndName.mockResolvedValue(true);
    await expect(useCase.execute(1, "u1", { name: "수정" })).rejects.toBeInstanceOf(
      ApplicationException,
    );
  });

  it("성공 시 갱신 + 캐시 무효화", async () => {
    const result = await useCase.execute(1, "u1", {
      name: "수정",
      color: "#FF0000",
    });
    expect(result.name).toBe("수정");
    expect(repo.update).toHaveBeenCalledWith(1, {
      name: "수정",
      color: "#FF0000",
    });
    expect(cache.invalidate).toHaveBeenCalledWith("u1");
  });

  it("이름이 기존과 같으면 중복 검사를 건너뛴다", async () => {
    await useCase.execute(1, "u1", { name: "기존" });
    expect(repo.existsByUserIdAndName).not.toHaveBeenCalled();
  });
});
