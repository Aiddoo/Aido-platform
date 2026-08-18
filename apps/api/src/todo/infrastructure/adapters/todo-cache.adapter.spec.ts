import { InMemoryCacheAdapter } from "@/shared/infrastructure/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import { FRIEND_TODOS_INITIAL_GENERATION, TodoCacheKey } from "../cache/todo-cache.keyspace";
import { TodoCacheAdapter } from "./todo-cache.adapter";

const OWNER_ID = "friend-1";
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
	let backend: InMemoryCacheAdapter;
	let adapter: TodoCacheAdapter;

	beforeEach(() => {
		backend = new InMemoryCacheAdapter({
			defaultTtlMs: 60_000,
			maxItems: 100,
			cleanupIntervalMs: 60_000,
		});
		adapter = new TodoCacheAdapter(new CacheService(backend));
	});

	afterEach(() => {
		backend.onModuleDestroy();
	});

	it("cache miss의 DB 조회 중 무효화되면 이전 응답을 stale-fill하지 않는다", async () => {
		// Given - R: generation을 잡고 cache miss 뒤 DB를 읽기 시작한 상태
		const staleRead = await adapter.readFriendTodosFirstPage(
			OWNER_ID,
			START_DATE,
			END_DATE,
			PAGE_SIZE,
		);
		expect(staleRead).toEqual({
			generation: FRIEND_TODOS_INITIAL_GENERATION,
			page: undefined,
		});

		// When - W: DB commit 후 generation을 먼저 회전하고, 늦게 끝난 R이 이전 결과를 저장 시도
		await adapter.invalidateFriendTodos(OWNER_ID);
		const stalePage = {
			items: [],
			pagination: { nextCursor: null, hasNext: false, size: PAGE_SIZE },
		};
		await adapter.storeFriendTodosFirstPageIfCurrent(
			OWNER_ID,
			START_DATE,
			END_DATE,
			PAGE_SIZE,
			staleRead.generation,
			stalePage,
		);

		// Then - 이전 generation에는 쓰지 않고 새 generation reader도 stale page를 보지 않는다
		expect(
			await backend.has(
				TodoCacheKey.friendTodosFirstPageVersioned(
					OWNER_ID,
					staleRead.generation,
					START_DATE,
					END_DATE,
					PAGE_SIZE,
				),
			),
		).toBe(false);

		const currentRead = await adapter.readFriendTodosFirstPage(
			OWNER_ID,
			START_DATE,
			END_DATE,
			PAGE_SIZE,
		);
		expect(currentRead.generation).not.toBe(staleRead.generation);
		expect(currentRead.page).toBeUndefined();
	});

	it("같은 generation 안에서 저장한 첫 페이지는 다시 읽는다", async () => {
		// Given
		const cacheRead = await adapter.readFriendTodosFirstPage(
			OWNER_ID,
			START_DATE,
			END_DATE,
			PAGE_SIZE,
		);
		const page = {
			items: [],
			pagination: { nextCursor: null, hasNext: false, size: PAGE_SIZE },
		};

		// When
		await adapter.storeFriendTodosFirstPageIfCurrent(
			OWNER_ID,
			START_DATE,
			END_DATE,
			PAGE_SIZE,
			cacheRead.generation,
			page,
		);

		// Then
		await expect(
			adapter.readFriendTodosFirstPage(OWNER_ID, START_DATE, END_DATE, PAGE_SIZE),
		).resolves.toEqual({ generation: cacheRead.generation, page });
	});

	it("page lookup 중 generation이 회전하면 이전 cache hit도 반환하지 않는다", async () => {
		// Given - 이전 generation page를 먼저 캡처하고 응답 직전 barrier에서 정지
		const stalePage = {
			items: [],
			pagination: { nextCursor: null, hasNext: false, size: PAGE_SIZE },
		};
		const cacheService = new CacheService(backend);
		const generationKey = TodoCacheKey.friendTodosGeneration(OWNER_ID);
		const pageKey = TodoCacheKey.friendTodosFirstPageVersioned(
			OWNER_ID,
			"generation-before-write",
			START_DATE,
			END_DATE,
			PAGE_SIZE,
		);
		await backend.set(generationKey, "generation-before-write", 60_000);
		await backend.set(pageKey, stalePage, 60_000);

		const pageReadStarted = createDeferred();
		const releasePageRead = createDeferred();
		const originalGet = cacheService.get.bind(cacheService);
		jest.spyOn(cacheService, "get").mockImplementation(async (key) => {
			const value = await originalGet(key);
			if (key === pageKey) {
				pageReadStarted.resolve();
				await releasePageRead.promise;
			}
			return value;
		});

		const readPromise = new TodoCacheAdapter(cacheService).readFriendTodosFirstPage(
			OWNER_ID,
			START_DATE,
			END_DATE,
			PAGE_SIZE,
		);
		await pageReadStarted.promise;

		// When - page GET은 이전 값을 쥔 채, 별도 writer가 generation을 먼저 회전
		await adapter.invalidateFriendTodos(OWNER_ID);
		releasePageRead.resolve();
		const result = await readPromise;

		// Then - page GET 이후 순차 재확인이 회전을 관측해 이전 cache hit를 버린다
		expect(result.generation).not.toBe("generation-before-write");
		expect(result.page).toBeUndefined();
	});
});
