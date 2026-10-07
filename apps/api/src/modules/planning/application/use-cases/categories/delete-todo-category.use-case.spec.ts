import { ErrorCode } from "@aido/api/errors";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type MutationLockPort } from "#api/shared/application/ports/index";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { PLANNING_TIME } from "#test/fixtures/planning-todo.fixture";
import { TodoCategoryFixture } from "#test/fixtures/todo.fixture";
import { StubPlanningEventPublisher } from "#test/mocks/ports/planning-todo.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";
import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { DeleteTodoCategory } from "./delete-todo-category.use-case.js";

const createCategory = (id = 1) =>
  TodoCategory.reconstitute(
    TodoCategoryFixture.create({
      id,
      userId: "category-user",
      name: `카테고리 ${id}`,
      sortOrder: id - 1,
    }),
  );

describe("카테고리 삭제", () => {
  let eventPublisher: StubPlanningEventPublisher;
  let useCase: DeleteTodoCategory;
  let repository: Mocked<ConstructorParameters<typeof DeleteTodoCategory>[0]["repository"]>;
  let cache: Mocked<TodoCategoryCachePort>;
  let mutationLock: Mocked<MutationLockPort>;
  let unitOfWork: UnitOfWorkPort;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    repository = mock<ConstructorParameters<typeof DeleteTodoCategory>[0]["repository"]>();
    cache = mock<TodoCategoryCachePort>();
    mutationLock = mock<MutationLockPort>();
    unitOfWork = createUnitOfWorkMock();
    eventPublisher = new StubPlanningEventPublisher();
    useCase = new DeleteTodoCategory({
      repository,
      cache,
      mutationLock,
      unitOfWork,
      eventPublisher,
      logger: mock<ApplicationLogger>(),
    });

    repository.findByIdAndUserId.mockResolvedValue(createCategory());
    repository.countByUserId.mockResolvedValue(2);
    repository.getTodoCount.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("존재하지 않으면 TODO_CATEGORY_0851", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(null);
    // When / Then
    await expect(useCase.execute({ userId: "category-user", categoryId: 1 })).rejects.toMatchObject(
      { errorCode: ErrorCode.TODO_CATEGORY_0851 },
    );
    expect(repository.moveTodosToCategory).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
    expect(eventPublisher.events).toEqual([]);
  });

  it("마지막 카테고리면 TODO_CATEGORY_0854", async () => {
    // Given
    repository.countByUserId.mockResolvedValue(1);
    // When / Then
    await expect(useCase.execute({ userId: "category-user", categoryId: 1 })).rejects.toMatchObject(
      { errorCode: ErrorCode.TODO_CATEGORY_0854 },
    );
    expect(repository.moveTodosToCategory).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
    expect(eventPublisher.events).toEqual([]);
  });

  it("할 일이 있는데 이동 대상 없으면 TODO_CATEGORY_0855", async () => {
    // Given
    repository.getTodoCount.mockResolvedValue(3);
    // When / Then
    await expect(useCase.execute({ userId: "category-user", categoryId: 1 })).rejects.toMatchObject(
      { errorCode: ErrorCode.TODO_CATEGORY_0855 },
    );
    expect(repository.moveTodosToCategory).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
    expect(eventPublisher.events).toEqual([]);
  });

  it("이동 대상이 자신과 같으면 SYS_0002", async () => {
    // Given
    repository.getTodoCount.mockResolvedValue(3);
    // When / Then
    await expect(
      useCase.execute({ userId: "category-user", categoryId: 1, moveToCategoryId: 1 }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(repository.moveTodosToCategory).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
    expect(eventPublisher.events).toEqual([]);
  });

  it("이동 대상이 없으면 TODO_CATEGORY_0851", async () => {
    // Given
    repository.getTodoCount.mockResolvedValue(3);
    repository.findByIdAndUserId
      .mockResolvedValueOnce(createCategory())
      .mockResolvedValueOnce(null);
    // When / Then
    await expect(
      useCase.execute({ userId: "category-user", categoryId: 1, moveToCategoryId: 2 }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0851 });
    expect(repository.moveTodosToCategory).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
    expect(eventPublisher.events).toEqual([]);
  });

  it("할 일을 대상 카테고리로 옮긴 뒤 삭제하고 캐시를 무효화한다", async () => {
    // Given
    repository.getTodoCount.mockResolvedValue(3);
    repository.findByIdAndUserId
      .mockResolvedValueOnce(createCategory(1))
      .mockResolvedValueOnce(createCategory(2));
    const categoryIds = new Set([1, 2]);
    const todoCategoryIds = [1, 1, 1];
    repository.moveTodosToCategory.mockImplementation(async (from, to) => {
      for (const [index, categoryId] of todoCategoryIds.entries())
        if (categoryId === from) todoCategoryIds[index] = to;
      return 3;
    });
    repository.delete.mockImplementation(async (id) => {
      categoryIds.delete(id);
    });

    // When
    await useCase.execute({ userId: "category-user", categoryId: 1, moveToCategoryId: 2 });

    // Then
    expect([...categoryIds]).toEqual([2]);
    expect(todoCategoryIds).toEqual([2, 2, 2]);
    expect(repository.moveTodosToCategory).toHaveBeenCalledWith(1, 2);
    expect(repository.delete).toHaveBeenCalledWith(1);
    expect(cache.invalidate).toHaveBeenCalledWith("category-user");
    expect(eventPublisher.events).toEqual([
      { eventName: "todo-category.deleted", userId: "category-user", categoryId: 1 },
    ]);
  });

  it("할 일 없으면 바로 삭제", async () => {
    // Given
    // When
    await useCase.execute({ userId: "category-user", categoryId: 1 });
    // Then
    expect(repository.moveTodosToCategory).not.toHaveBeenCalled();
    expect(repository.delete).toHaveBeenCalledWith(1);
  });

  it("사용자 카테고리 키를 UoW 안에서 첫 구조 읽기 전에 잠그고 UoW callback 성공 후 캐시를 무효화한다", async () => {
    // Given - 삭제 transaction 경계와 구조 읽기 순서 기록
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
    repository.findByIdAndUserId.mockImplementation(async () => {
      events.push("category-read");
      return createCategory();
    });
    repository.countByUserId.mockImplementation(async () => {
      events.push("count");
      return 2;
    });
    repository.getTodoCount.mockImplementation(async () => {
      events.push("todo-count");
      return 0;
    });
    repository.delete.mockImplementation(async () => {
      events.push("delete");
    });
    cache.invalidate.mockImplementation(async () => {
      events.push("cache");
    });

    // When
    await useCase.execute({ userId: "category-user", categoryId: 1 });

    // Then
    expect(mutationLock.acquire).toHaveBeenCalledWith([
      "mutation:v1:todo-category:category-user",
      "mutation:v1:todo-sort-order:category-user",
    ]);
    expect(events).toEqual([
      "uow:start",
      "lock",
      "category-read",
      "count",
      "todo-count",
      "delete",
      "uow:resolved",
      "cache",
    ]);
  });
});
