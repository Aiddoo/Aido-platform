import { ErrorCode } from "@aido/api/errors";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type MutationLockPort } from "#api/shared/application/ports/index";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { PLANNING_TIME } from "#test/fixtures/planning-todo.fixture";
import { TodoCategoryFixture } from "#test/fixtures/todo.fixture";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";
import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { ReorderTodoCategory } from "./reorder-todo-category.use-case.js";

const createCategory = (id: number, sortOrder: number) =>
  TodoCategory.reconstitute(
    TodoCategoryFixture.create({ id, userId: "category-user", name: `카테고리 ${id}`, sortOrder }),
  );

describe("카테고리 재정렬", () => {
  let useCase: ReorderTodoCategory;
  let repository: Mocked<ConstructorParameters<typeof ReorderTodoCategory>[0]["repository"]>;
  let cache: Mocked<TodoCategoryCachePort>;
  let mutationLock: Mocked<MutationLockPort>;
  let unitOfWork: UnitOfWorkPort;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    repository = mock<ConstructorParameters<typeof ReorderTodoCategory>[0]["repository"]>();
    cache = mock<TodoCategoryCachePort>();
    mutationLock = mock<MutationLockPort>();
    unitOfWork = createUnitOfWorkMock();
    useCase = new ReorderTodoCategory({
      repository,
      cache,
      mutationLock,
      unitOfWork,
      logger: mock<ApplicationLogger>(),
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
      useCase.execute({ userId: "category-user", categoryId: 9, position: "before" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0851 });
    expect(repository.shiftSortOrders).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
    repository.findByIdAndUserId
      .mockResolvedValueOnce(createCategory(1, 0))
      .mockResolvedValueOnce(null);
    await expect(
      useCase.execute({
        userId: "category-user",
        categoryId: 1,
        targetCategoryId: 9,
        position: "before",
      }),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_CATEGORY_0851,
      details: { categoryId: 9 },
    });
    expect(repository.shiftSortOrders).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("자기 자신 대상이면 no-op(업데이트 없음)", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(createCategory(1, 0));
    // When
    const result = await useCase.execute({
      userId: "category-user",
      categoryId: 1,
      targetCategoryId: 1,
      position: "before",
    });
    // Then
    expect(result.id).toBe(1);
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.shiftSortOrders).not.toHaveBeenCalled();
  });

  it("기준 카테고리 앞으로 이동하고 사이 순서와 캐시를 갱신한다", async () => {
    // Given
    repository.findByIdAndUserId
      .mockResolvedValueOnce(createCategory(3, 2))
      .mockResolvedValueOnce(createCategory(1, 0));
    repository.shiftSortOrders.mockResolvedValue(2);
    repository.update.mockResolvedValue(createCategory(3, 0));

    // When
    const result = await useCase.execute({
      userId: "category-user",
      categoryId: 3,
      targetCategoryId: 1,
      position: "before",
    });

    // Then
    expect(repository.shiftSortOrders).toHaveBeenCalledWith("category-user", 0, 1, 1);
    expect(repository.update).toHaveBeenCalledWith(3, { sortOrder: 0 });
    expect(result.sortOrder).toBe(0);
    expect(cache.invalidate).toHaveBeenCalledWith("category-user");
  });

  it("맨 뒤로 이동하면 마지막 순서를 저장한다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(createCategory(1, 0));
    repository.getMaxSortOrder.mockResolvedValue(2);
    repository.shiftSortOrders.mockResolvedValue(2);
    repository.update.mockResolvedValue(createCategory(1, 2));

    // When
    const result = await useCase.execute({
      userId: "category-user",
      categoryId: 1,
      position: "after",
    });

    // Then
    expect(repository.shiftSortOrders).toHaveBeenCalledWith("category-user", 1, null, -1);
    expect(repository.update).toHaveBeenCalledWith(1, { sortOrder: 2 });
    expect(result.sortOrder).toBe(2);
  });

  it("사용자 카테고리 키를 UoW 안에서 첫 구조 읽기 전에 잠그고 UoW callback 성공 후 캐시를 무효화한다", async () => {
    // Given - 재배치 transaction 경계와 구조 읽기 순서 기록
    const events: string[] = [];
    unitOfWork.run = async (work) => {
      events.push("uow:start");
      const result = await work();
      events.push("uow:resolved");
      return result;
    };
    mutationLock.acquire.mockImplementation(async () => {
      events.push("lock");
    });
    repository.findByIdAndUserId
      .mockImplementationOnce(async () => {
        events.push("category-read");
        return createCategory(3, 2);
      })
      .mockImplementationOnce(async () => {
        events.push("target-read");
        return createCategory(1, 0);
      });
    repository.shiftSortOrders.mockImplementation(async () => {
      events.push("shift");
      return 2;
    });
    repository.update.mockImplementation(async () => {
      events.push("update");
      return createCategory(3, 0);
    });
    cache.invalidate.mockImplementation(async () => {
      events.push("cache");
    });

    // When
    await useCase.execute({
      userId: "category-user",
      categoryId: 3,
      targetCategoryId: 1,
      position: "before",
    });

    // Then
    expect(mutationLock.acquire).toHaveBeenCalledWith(["mutation:v1:todo-category:category-user"]);
    expect(events).toEqual([
      "uow:start",
      "lock",
      "category-read",
      "target-read",
      "shift",
      "update",
      "uow:resolved",
      "cache",
    ]);
  });
});
