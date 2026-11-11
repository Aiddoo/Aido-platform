import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { FakeTodoCategoryCache } from "#test/doubles/planning/fake-todo-category-cache";
import { InMemoryTodoCategoryRepository } from "#test/doubles/planning/in-memory-todo-category.repository";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTodoCategoryFixture } from "#test/fixtures/planning/todo-category.fixture";
import { TODO_FIXTURE_USER_ID } from "#test/fixtures/planning/todo.fixture";

import type { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import type { TodoCategory } from "../../domain/todo-category.aggregate.js";
import type { UpdateCategoryInput } from "../ports/todo-category.repository.port.js";
import { ReorderTodoCategoryUseCase } from "./reorder-todo-category.use-case.js";

const USER_ID = TODO_FIXTURE_USER_ID;

// id 1·2·3이 순서 0·1·2에 있다
function categories(): TodoCategory[] {
  return [1, 2, 3].map((id) =>
    createTodoCategoryFixture({ id, name: `카테고리 ${id}`, sortOrder: id - 1 }),
  );
}

function setUp(
  overrides: {
    readonly repository?: InMemoryTodoCategoryRepository;
    readonly cache?: FakeTodoCategoryCache;
    readonly mutationLock?: RecordingMutationLock;
    readonly unitOfWork?: ImmediateUnitOfWork;
  } = {},
) {
  const repository = overrides.repository ?? new InMemoryTodoCategoryRepository(categories());
  const cache = overrides.cache ?? new FakeTodoCategoryCache();
  const mutationLock = overrides.mutationLock ?? new RecordingMutationLock();
  const todoCache = new FakeTodoCache();
  const afterCommit = new RecordingAfterCommitRegistry();
  const useCase = new ReorderTodoCategoryUseCase({
    repository,
    cache,
    todoCache,
    afterCommit,
    mutationLock,
    unitOfWork: overrides.unitOfWork ?? new ImmediateUnitOfWork(),
    logger: new SilentLogger(),
  });
  return { repository, cache, todoCache, afterCommit, mutationLock, useCase };
}

async function sortOrders(repository: InMemoryTodoCategoryRepository): Promise<number[][]> {
  return (await repository.findManyByUserId(UserId.reconstitute(USER_ID))).map((category) => [
    category.id,
    category.sortOrder,
  ]);
}

describe("카테고리 재정렬", () => {
  it.each([
    {
      name: "옮길 카테고리",
      command: { categoryId: 9, position: "before" },
      details: { categoryId: 9 },
    },
    {
      name: "기준 카테고리",
      command: { categoryId: 1, targetCategoryId: 9, position: "before" },
      details: { categoryId: 9 },
    },
  ] as const)(
    "$name가 없으면 TODO_CATEGORY_0851이고 순서를 바꾸지 않는다",
    async ({ command, details }) => {
      // Given
      const { repository, cache, useCase } = setUp();

      // When
      const reorder = useCase.execute({ userId: USER_ID, ...command });

      // Then
      await expect(reorder).rejects.toMatchObject({
        errorCode: ErrorCode.TODO_CATEGORY_0851,
        details,
      });
      expect(await sortOrders(repository)).toEqual([
        [1, 0],
        [2, 1],
        [3, 2],
      ]);
      expect(cache.invalidatedUserIds).toEqual([]);
    },
  );

  it("자기 자신 대상이면 순서를 바꾸지 않고 그대로 돌려준다", async () => {
    // Given
    const { repository, afterCommit, useCase } = setUp();

    // When
    const result = await useCase.execute({
      userId: USER_ID,
      categoryId: 1,
      targetCategoryId: 1,
      position: "before",
    });

    // Then
    expect(result.id.value).toBe(1);
    expect(await sortOrders(repository)).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
    ]);
    expect(afterCommit.tasks).toEqual([]);
  });

  it("기준 카테고리 앞으로 이동하고 사이 순서와 캐시를 갱신한다", async () => {
    // Given
    const { repository, cache, useCase } = setUp();

    // When
    const result = await useCase.execute({
      userId: USER_ID,
      categoryId: 3,
      targetCategoryId: 1,
      position: "before",
    });

    // Then
    expect(result.sortOrder).toBe(0);
    expect(await sortOrders(repository)).toEqual([
      [3, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(cache.invalidatedUserIds).toEqual([USER_ID]);
  });

  it("순서를 바꾸면 친구 화면 할 일 캐시를 커밋 뒤에 지운다", async () => {
    // Given
    const { todoCache, afterCommit, useCase } = setUp();

    // When
    await useCase.execute({ userId: USER_ID, categoryId: 1, position: "after" });
    const beforeCommit = todoCache.generations.get(USER_ID);
    await afterCommit.runAll();

    // Then
    expect(beforeCommit).toBeUndefined();
    expect(todoCache.generations.get(USER_ID)).toBe(1);
  });

  it("맨 뒤로 이동하면 마지막 순서를 저장한다", async () => {
    // Given
    const { repository, useCase } = setUp();

    // When
    const result = await useCase.execute({ userId: USER_ID, categoryId: 1, position: "after" });

    // Then
    expect(result.sortOrder).toBe(2);
    expect(await sortOrders(repository)).toEqual([
      [2, 0],
      [3, 1],
      [1, 2],
    ]);
  });

  it("사용자 카테고리 키를 UoW 안에서 첫 구조 읽기 전에 잠그고 UoW callback 성공 후 캐시를 무효화한다", async () => {
    // Given - 재배치 transaction 경계와 구조 읽기 순서 기록
    const events: string[] = [];
    class OrderedUnitOfWork extends ImmediateUnitOfWork {
      override async run<T>(work: () => Promise<T>): Promise<T> {
        events.push("uow:start");
        const result = await work();
        events.push("uow:resolved");
        return result;
      }
    }
    class OrderedMutationLock extends RecordingMutationLock {
      override async acquire(keys: readonly string[]): Promise<void> {
        events.push("lock");
        await super.acquire(keys);
      }
    }
    class OrderedRepository extends InMemoryTodoCategoryRepository {
      override async findByIdAndUserId(id: TodoCategoryId, userId: UserId) {
        events.push(id.value === 3 ? "category-read" : "target-read");
        return super.findByIdAndUserId(id, userId);
      }
      override async shiftSortOrders(
        userId: UserId,
        fromSortOrder: number,
        toSortOrder: number | null,
        delta: number,
      ): Promise<number> {
        events.push("shift");
        return super.shiftSortOrders(userId, fromSortOrder, toSortOrder, delta);
      }
      override async update(id: TodoCategoryId, input: UpdateCategoryInput): Promise<TodoCategory> {
        events.push("update");
        return super.update(id, input);
      }
    }
    class OrderedCache extends FakeTodoCategoryCache {
      override async invalidate(userId: UserId): Promise<void> {
        events.push("cache");
        await super.invalidate(userId);
      }
    }
    const mutationLock = new OrderedMutationLock();
    const { useCase } = setUp({
      repository: new OrderedRepository(categories()),
      cache: new OrderedCache(),
      mutationLock,
      unitOfWork: new OrderedUnitOfWork(),
    });

    // When
    await useCase.execute({
      userId: USER_ID,
      categoryId: 3,
      targetCategoryId: 1,
      position: "before",
    });

    // Then
    expect(mutationLock.acquiredKeys).toEqual([[`mutation:v1:todo-category:${USER_ID}`]]);
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
