import { ErrorCode } from "@aido/api/errors";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { MutationLockPort, UnitOfWorkPort } from "#api/shared/application/ports/index";
import { PLANNING_TIME } from "#test/fixtures/planning-todo.fixture";
import { TodoCategoryFixture } from "#test/fixtures/todo.fixture";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";
import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { UpdateTodoCategory } from "./update-todo-category.use-case.js";

describe("카테고리 수정", () => {
  let savedCategory: ReturnType<typeof TodoCategoryFixture.create>;
  let unitOfWork: UnitOfWorkPort;
  let useCase: UpdateTodoCategory;
  let repository: Mocked<ConstructorParameters<typeof UpdateTodoCategory>[0]["repository"]>;
  let cache: Mocked<TodoCategoryCachePort>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    repository = mock<ConstructorParameters<typeof UpdateTodoCategory>[0]["repository"]>();
    cache = mock<TodoCategoryCachePort>();
    const mutationLock = mock<MutationLockPort>();
    unitOfWork = createUnitOfWorkMock();
    useCase = new UpdateTodoCategory({
      repository,
      cache,
      mutationLock,
      unitOfWork,
      logger: mock<ApplicationLogger>(),
    });

    savedCategory = TodoCategoryFixture.create({
      id: 1,
      userId: "category-user",
      name: "기존",
      color: "#FFB3B3",
      sortOrder: 0,
    });
    repository.findByIdAndUserId.mockImplementation(async (id, userId) =>
      savedCategory.id === id && savedCategory.userId === userId
        ? TodoCategory.reconstitute(savedCategory)
        : null,
    );
    repository.existsByUserIdAndName.mockResolvedValue(false);
    repository.update.mockImplementation(async (_id, input) => {
      savedCategory = {
        ...savedCategory,
        name: input.name ?? savedCategory.name,
        color: input.color ?? savedCategory.color,
      };
      return TodoCategory.reconstitute(savedCategory);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("존재하지 않으면 TODO_CATEGORY_0851", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(null);
    // When / Then
    await expect(
      useCase.execute({ id: 1, userId: "category-user", data: { name: "수정" } }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0851 });
    expect(repository.update).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it("이름 변경 시 중복이면 TODO_CATEGORY_0853", async () => {
    // Given
    repository.existsByUserIdAndName.mockResolvedValue(true);
    // When / Then
    await expect(
      useCase.execute({ id: 1, userId: "category-user", data: { name: "수정" } }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0853 });
    expect(repository.update).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it("수정한 이름과 색상을 저장하고 캐시를 무효화한다", async () => {
    // Given
    const callbackFinished = Promise.withResolvers<void>();
    const releaseCallback = Promise.withResolvers<void>();
    unitOfWork.run = async (work) => {
      const result = await work();
      callbackFinished.resolve();
      await releaseCallback.promise;
      return result;
    };
    // When
    const execution = useCase.execute({
      id: 1,
      userId: "category-user",
      data: { name: "수정", color: "#FF0000" },
    });
    try {
      await Promise.race([callbackFinished.promise, execution]);
      expect(cache.invalidate).not.toHaveBeenCalled();
    } finally {
      releaseCallback.resolve();
      await execution;
    }
    const result = await execution;
    // Then
    expect(savedCategory).toMatchObject({
      name: "수정",
      color: "#FF0000",
      sortOrder: 0,
      createdAt: PLANNING_TIME,
    });
    expect(result.name).toBe("수정");
    expect(repository.update).toHaveBeenCalledWith(1, {
      name: "수정",
      color: "#FF0000",
    });
    expect(cache.invalidate).toHaveBeenCalledWith("category-user");
  });

  it("이름이 기존과 같으면 중복 검사를 건너뛴다", async () => {
    // Given
    // When
    await useCase.execute({ id: 1, userId: "category-user", data: { name: "기존" } });
    // Then
    expect(repository.existsByUserIdAndName).not.toHaveBeenCalled();
  });
});
