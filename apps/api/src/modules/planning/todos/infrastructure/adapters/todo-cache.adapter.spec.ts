import { vi } from "vitest";

import { TodoCategoryCacheAdapter } from "#api/modules/planning/todo-categories/infrastructure/adapters/todo-category-cache.adapter";
import { TodoCategoryCacheKey } from "#api/modules/planning/todo-categories/infrastructure/cache/todo-category-cache.keyspace";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  FRIEND_TODOS_INITIAL_GENERATION,
  TODO_CACHE_TTL_MS,
  TodoCacheKey,
} from "../cache/todo-cache.keyspace.js";
import { TodoCacheAdapter } from "./todo-cache.adapter.js";

const OWNER_ID = UserId.reconstitute("friend-1");
const START_DATE = "2026-07-01";
const END_DATE = "2026-07-31";
const PAGE_SIZE = 20;

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

function createDeferred(): Deferred {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });

  return { promise, resolve: () => resolve?.() };
}

describe("TodoCacheAdapter — 친구 Todo generation 캐시", () => {
  let backend: InMemoryCacheStore;
  let adapter: TodoCacheAdapter;

  beforeEach(() => {
    backend = new InMemoryCacheStore({
      defaultTtlMs: 60_000,
      maxItems: 100,
    });
    adapter = new TodoCacheAdapter(backend, new TodoCategoryCacheAdapter(backend));
  });

  it("cache miss의 DB 조회 중 무효화되면 이전 응답을 stale-fill하지 않는다", async () => {
    // Given
    // R: generation을 잡고 cache miss 뒤 DB를 읽기 시작한 상태
    const staleRead = await adapter.readFriendTodosFirstPage({
      ownerUserId: OWNER_ID,
      startDate: START_DATE,
      endDate: END_DATE,
      size: PAGE_SIZE,
    });
    expect(staleRead).toEqual({
      generation: FRIEND_TODOS_INITIAL_GENERATION,
      page: undefined,
    });

    // When
    // W: DB commit 후 generation을 먼저 회전하고, 늦게 끝난 R이 이전 결과를 저장 시도
    await adapter.invalidateFriendTodos(OWNER_ID);
    const stalePage = {
      items: [],
      pagination: { nextCursor: null, hasNext: false, size: PAGE_SIZE },
    };
    await adapter.storeFriendTodosFirstPageIfCurrent(
      { ownerUserId: OWNER_ID, startDate: START_DATE, endDate: END_DATE, size: PAGE_SIZE },
      staleRead.generation,
      stalePage,
    );

    // Then
    // 이전 generation에는 쓰지 않고 새 generation reader도 stale page를 보지 않는다
    expect(
      await backend.has(
        TodoCacheKey.friendTodosFirstPageVersioned({
          ownerUserId: OWNER_ID.value,
          generation: staleRead.generation,
          startDate: START_DATE,
          endDate: END_DATE,
          size: PAGE_SIZE,
        }),
      ),
    ).toBe(false);

    const currentRead = await adapter.readFriendTodosFirstPage({
      ownerUserId: OWNER_ID,
      startDate: START_DATE,
      endDate: END_DATE,
      size: PAGE_SIZE,
    });
    expect(currentRead.generation).not.toBe(staleRead.generation);
    expect(currentRead.page).toBeUndefined();
  });

  it("같은 generation 안에서 저장한 첫 페이지는 다시 읽는다", async () => {
    // Given
    const cacheRead = await adapter.readFriendTodosFirstPage({
      ownerUserId: OWNER_ID,
      startDate: START_DATE,
      endDate: END_DATE,
      size: PAGE_SIZE,
    });
    const page = {
      items: [],
      pagination: { nextCursor: null, hasNext: false, size: PAGE_SIZE },
    };

    // When
    await adapter.storeFriendTodosFirstPageIfCurrent(
      { ownerUserId: OWNER_ID, startDate: START_DATE, endDate: END_DATE, size: PAGE_SIZE },
      cacheRead.generation,
      page,
    );

    // Then
    await expect(
      adapter.readFriendTodosFirstPage({
        ownerUserId: OWNER_ID,
        startDate: START_DATE,
        endDate: END_DATE,
        size: PAGE_SIZE,
      }),
    ).resolves.toEqual({ generation: cacheRead.generation, page });
  });

  it("무효화는 세대만 바꾸고 이전 세대 페이지는 짧은 TTL에 맡기며 새 조회에 보이지 않는다", async () => {
    // Given
    const cacheRead = await adapter.readFriendTodosFirstPage({
      ownerUserId: OWNER_ID,
      startDate: START_DATE,
      endDate: END_DATE,
      size: PAGE_SIZE,
    });
    const page = {
      items: [],
      pagination: { nextCursor: null, hasNext: false, size: PAGE_SIZE },
    };
    await adapter.storeFriendTodosFirstPageIfCurrent(
      { ownerUserId: OWNER_ID, startDate: START_DATE, endDate: END_DATE, size: PAGE_SIZE },
      cacheRead.generation,
      page,
    );
    const previousPageKey = TodoCacheKey.friendTodosFirstPageVersioned({
      ownerUserId: OWNER_ID.value,
      generation: cacheRead.generation,
      startDate: START_DATE,
      endDate: END_DATE,
      size: PAGE_SIZE,
    });

    // When
    await adapter.invalidateFriendTodos(OWNER_ID);

    // Then
    expect(await backend.ttl(previousPageKey)).toBeLessThanOrEqual(TODO_CACHE_TTL_MS.FRIEND_VIEW);
    await expect(
      adapter.readFriendTodosFirstPage({
        ownerUserId: OWNER_ID,
        startDate: START_DATE,
        endDate: END_DATE,
        size: PAGE_SIZE,
      }),
    ).resolves.toMatchObject({ page: undefined });
  });

  it("page lookup 중 generation이 회전하면 이전 cache hit도 반환하지 않는다", async () => {
    // Given
    // 이전 generation page를 먼저 캡처하고 응답 직전 barrier에서 정지
    const stalePage = {
      items: [],
      pagination: { nextCursor: null, hasNext: false, size: PAGE_SIZE },
    };
    const cacheService = backend;
    const generationKey = TodoCacheKey.friendTodosGeneration(OWNER_ID.value);
    const pageKey = TodoCacheKey.friendTodosFirstPageVersioned({
      ownerUserId: OWNER_ID.value,
      generation: "generation-before-write",
      startDate: START_DATE,
      endDate: END_DATE,
      size: PAGE_SIZE,
    });
    await backend.set(generationKey, "generation-before-write", 60_000);
    await backend.set(pageKey, stalePage, 60_000);

    const pageReadStarted = createDeferred();
    const releasePageRead = createDeferred();
    const originalGet = cacheService.get.bind(cacheService);
    vi.spyOn(cacheService, "get").mockImplementation(async (key, schema) => {
      const value = await originalGet(key, schema);
      if (key === pageKey) {
        pageReadStarted.resolve();
        await releasePageRead.promise;
      }
      return value;
    });

    const readPromise = new TodoCacheAdapter(
      cacheService,
      new TodoCategoryCacheAdapter(cacheService),
    ).readFriendTodosFirstPage({
      ownerUserId: OWNER_ID,
      startDate: START_DATE,
      endDate: END_DATE,
      size: PAGE_SIZE,
    });
    await pageReadStarted.promise;

    // When
    // page GET은 이전 값을 쥔 채, 별도 writer가 generation을 먼저 회전
    await adapter.invalidateFriendTodos(OWNER_ID);
    releasePageRead.resolve();
    const result = await readPromise;

    // Then
    // page GET 이후 순차 재확인이 회전을 관측해 이전 cache hit를 버린다
    expect(result.generation).not.toBe("generation-before-write");
    expect(result.page).toBeUndefined();
  });
});

describe("TodoCacheAdapter — 할 일 쓰기의 카테고리 목록 무효화", () => {
  it("카테고리 목록 세대를 바꿔 쓰기 커밋 전에 센 todoCount가 다시 저장되지 않는다", async () => {
    // Given
    const backend = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    const categoryCache = new TodoCategoryCacheAdapter(backend);
    const adapter = new TodoCacheAdapter(backend, categoryCache);
    const userId = UserId.reconstitute("user-1");
    const generationKey = TodoCategoryCacheKey.listGeneration(userId.value);
    const countedBeforeTodoWrite = async () => {
      await adapter.invalidateTodoCategories(userId);
      return [];
    };

    // When
    await categoryCache.wrapList(userId, countedBeforeTodoWrite);

    // Then
    expect(await backend.has(generationKey)).toBe(true);
    expect(await backend.has(TodoCategoryCacheKey.list(userId.value))).toBe(false);
  });
});
