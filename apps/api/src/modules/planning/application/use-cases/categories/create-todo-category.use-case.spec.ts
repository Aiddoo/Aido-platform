import { ErrorCode } from "@aido/api/errors";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { PLANNING_TIME } from "#test/fixtures/planning-todo.fixture";
import { TodoCategoryFixture } from "#test/fixtures/todo.fixture";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";
import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { type TodoCategoryLimitReaderPort } from "../../ports/categories/todo-category-limit-reader.port.js";
import { CreateTodoCategory } from "./create-todo-category.use-case.js";

const createCategory = () =>
  TodoCategory.reconstitute(
    TodoCategoryFixture.create({
      id: 1,
      userId: "category-user",
      name: "새 카테고리",
      sortOrder: 1,
    }),
  );

describe("카테고리 생성", () => {
  let savedCategory: ReturnType<typeof TodoCategoryFixture.create> | undefined;
  let useCase: CreateTodoCategory;
  let repository: Mocked<ConstructorParameters<typeof CreateTodoCategory>[0]["repository"]>;
  let cache: Mocked<TodoCategoryCachePort>;
  let limitReader: Mocked<TodoCategoryLimitReaderPort>;
  let mutationLock: Mocked<MutationLockPort>;
  let unitOfWork: UnitOfWorkPort;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    repository = mock<ConstructorParameters<typeof CreateTodoCategory>[0]["repository"]>();
    cache = mock<TodoCategoryCachePort>();
    limitReader = mock<TodoCategoryLimitReaderPort>();
    mutationLock = mock<MutationLockPort>();
    unitOfWork = createUnitOfWorkMock();
    useCase = new CreateTodoCategory({
      repository,
      cache,
      mutationLock,
      unitOfWork,
      logger: mock<ApplicationLogger>(),
      limitReader,
    });

    limitReader.getMaxCountInTx.mockResolvedValue(null);
    repository.countByUserId.mockResolvedValue(2);
    repository.existsByUserIdAndName.mockResolvedValue(false);
    repository.getMaxSortOrder.mockResolvedValue(0);
    savedCategory = undefined;
    repository.create.mockImplementation(async (input) => {
      savedCategory = TodoCategoryFixture.create({ id: 1, ...input });
      return TodoCategory.reconstitute(savedCategory);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("한도 초과면 TODO_CATEGORY_0857", async () => {
    // Given
    limitReader.getMaxCountInTx.mockResolvedValue(3);
    repository.countByUserId.mockResolvedValue(3);

    // When / Then
    await expect(
      useCase.execute({ userId: "category-user", name: "x", color: "#FFB3B3" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0857 });
    expect(repository.create).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it("중복 이름이면 TODO_CATEGORY_0853", async () => {
    // Given
    repository.existsByUserIdAndName.mockResolvedValue(true);
    // When / Then
    await expect(
      useCase.execute({ userId: "category-user", name: "x", color: "#FFB3B3" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0853 });
    expect(repository.create).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it("새 카테고리를 맨 뒤 순번으로 저장하고 캐시를 무효화한다", async () => {
    // Given
    // When
    const result = await useCase.execute({
      userId: "category-user",
      name: "새 카테고리",
      color: "#FFB3B3",
    });
    // Then
    expect(savedCategory).toMatchObject({
      id: 1,
      name: "새 카테고리",
      color: "#FFB3B3",
      sortOrder: 1,
      createdAt: PLANNING_TIME,
    });
    expect(result.id).toBe(1);
    expect(repository.create).toHaveBeenCalledWith({
      userId: "category-user",
      name: "새 카테고리",
      color: "#FFB3B3",
      sortOrder: 1,
    });
    expect(cache.invalidate).toHaveBeenCalledWith("category-user");
  });

  it("사용자 카테고리 키를 UoW 안에서 모든 guarded read 전에 잠그고 UoW callback 성공 후 캐시를 무효화한다", async () => {
    // Given - UoW/lock/read/write/cache 경계의 관찰 가능한 순서
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
    limitReader.getMaxCountInTx.mockImplementation(async () => {
      events.push("entitlement");
      return 3;
    });
    repository.countByUserId.mockImplementation(async () => {
      events.push("count");
      return 2;
    });
    repository.existsByUserIdAndName.mockImplementation(async () => {
      events.push("name-read");
      return false;
    });
    repository.getMaxSortOrder.mockImplementation(async () => {
      events.push("max-order-read");
      return 0;
    });
    repository.create.mockImplementation(async () => {
      events.push("create");
      return createCategory();
    });
    cache.invalidate.mockImplementation(async () => {
      events.push("cache");
    });

    // When - 새 카테고리 생성
    await useCase.execute({
      userId: "category-user",
      name: "새 카테고리",
      color: "#FFB3B3",
    });

    // Then - 한 user-scoped key가 모든 구조 읽기보다 먼저이고 cache는 callback 성공 뒤
    expect(mutationLock.acquire).toHaveBeenCalledWith(["mutation:v1:todo-category:category-user"]);
    expect(events).toEqual([
      "uow:start",
      "lock",
      "entitlement",
      "count",
      "name-read",
      "max-order-read",
      "create",
      "uow:resolved",
      "cache",
    ]);
  });
});
