import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";
import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { type TodoCategoryLimitReaderPort } from "../../ports/categories/todo-category-limit-reader.port.js";
import { type TodoCategoryRepositoryPort } from "../../ports/categories/todo-category.repository.port.js";
import { CreateTodoCategory } from "./create-todo-category.use-case.js";

const created = TodoCategory.reconstitute({
  id: 1,
  userId: "u1",
  name: "새 카테고리",
  color: "#FFB3B3",
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("CreateTodoCategory", () => {
  let useCase: CreateTodoCategory;
  let repo: Mocked<TodoCategoryRepositoryPort>;
  let cache: Mocked<TodoCategoryCachePort>;
  let limitReader: Mocked<TodoCategoryLimitReaderPort>;
  let mutationLock: Mocked<MutationLockPort>;
  let uow: Mocked<UnitOfWorkPort>;

  beforeEach(async () => {
    const createTodoCategoryDependencies = mockDeep<
      ConstructorParameters<typeof CreateTodoCategory>[0]
    >({ mutationLock: { acquire: vi.fn() }, unitOfWork: { run: vi.fn((work) => work()) } });
    const unit = new CreateTodoCategory(createTodoCategoryDependencies);
    useCase = unit;
    repo = createTodoCategoryDependencies.repository;
    cache = createTodoCategoryDependencies.cache;
    limitReader = createTodoCategoryDependencies.limitReader;
    mutationLock = createTodoCategoryDependencies.mutationLock;
    uow = createTodoCategoryDependencies.unitOfWork;

    limitReader.getMaxCountInTx.mockResolvedValue(null);
    repo.countByUserId.mockResolvedValue(2);
    repo.existsByUserIdAndName.mockResolvedValue(false);
    repo.getMaxSortOrder.mockResolvedValue(0);
    repo.create.mockResolvedValue(created);
  });

  it("한도 초과면 TODO_CATEGORY_0857", async () => {
    limitReader.getMaxCountInTx.mockResolvedValue(3);
    repo.countByUserId.mockResolvedValue(3);

    await expect(
      useCase.execute({ userId: "u1", name: "x", color: "#FFB3B3" }),
    ).rejects.toBeInstanceOf(ApplicationException);
  });

  it("중복 이름이면 TODO_CATEGORY_0853", async () => {
    repo.existsByUserIdAndName.mockResolvedValue(true);
    await expect(
      useCase.execute({ userId: "u1", name: "x", color: "#FFB3B3" }),
    ).rejects.toBeInstanceOf(ApplicationException);
  });

  it("성공 시 맨 뒤 순번으로 생성 + 캐시 무효화", async () => {
    const result = await useCase.execute({
      userId: "u1",
      name: "새 카테고리",
      color: "#FFB3B3",
    });
    expect(result.id).toBe(1);
    expect(repo.create).toHaveBeenCalledWith({
      userId: "u1",
      name: "새 카테고리",
      color: "#FFB3B3",
      sortOrder: 1,
    });
    expect(cache.invalidate).toHaveBeenCalledWith("u1");
  });

  it("사용자 카테고리 키를 UoW 안에서 모든 guarded read 전에 잠그고 커밋 후 캐시를 무효화한다", async () => {
    // Given - transaction/lock/read/write/post-commit 경계의 관찰 가능한 순서
    const events: string[] = [];
    uow.run.mockImplementation(async (work) => {
      events.push("uow:start");
      const result = await work();
      events.push("uow:commit");
      return result;
    });
    mutationLock.acquire.mockImplementation(async () => {
      events.push("lock");
    });
    limitReader.getMaxCountInTx.mockImplementation(async () => {
      events.push("entitlement");
      return 3;
    });
    repo.countByUserId.mockImplementation(async () => {
      events.push("count");
      return 2;
    });
    repo.existsByUserIdAndName.mockImplementation(async () => {
      events.push("name-read");
      return false;
    });
    repo.getMaxSortOrder.mockImplementation(async () => {
      events.push("max-order-read");
      return 0;
    });
    repo.create.mockImplementation(async () => {
      events.push("create");
      return created;
    });
    cache.invalidate.mockImplementation(async () => {
      events.push("cache");
    });

    // When - 새 카테고리 생성
    await useCase.execute({
      userId: "u1",
      name: "새 카테고리",
      color: "#FFB3B3",
    });

    // Then - 한 user-scoped key가 모든 구조 읽기보다 먼저이고 cache는 commit 뒤
    expect(mutationLock.acquire).toHaveBeenCalledWith(["mutation:v1:todo-category:u1"]);
    expect(events).toEqual([
      "uow:start",
      "lock",
      "entitlement",
      "count",
      "name-read",
      "max-order-read",
      "create",
      "uow:commit",
      "cache",
    ]);
  });
});
