import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from "@aido/validators";

import { InMemoryCacheAdapter } from "@/shared/infrastructure/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import { TodoCommentCacheAdapter } from "./todo-comment-cache.adapter";

const TODO_ID = 42;
const PAGE = {
	items: [],
	nextCursor: null,
	hasNext: false,
	size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
};

describe("TodoCommentCacheAdapter — generation cache", () => {
	let backend: InMemoryCacheAdapter;
	let adapter: TodoCommentCacheAdapter;

	beforeEach(() => {
		backend = new InMemoryCacheAdapter({
			defaultTtlMs: 60_000,
			maxItems: 100,
			cleanupIntervalMs: 60_000,
		});
		adapter = new TodoCommentCacheAdapter(new CacheService(backend));
	});

	afterEach(() => backend.onModuleDestroy());

	it("조회 뒤 generation이 회전하면 이전 응답을 stale-fill하지 않는다", async () => {
		const staleRead = await adapter.readTopLevelFirstPage(TODO_ID, TODO_COMMENT_SORT.LATEST);

		await adapter.invalidateTopLevelFirstPages(TODO_ID);
		await adapter.storeTopLevelFirstPageIfCurrent(
			TODO_ID,
			TODO_COMMENT_SORT.LATEST,
			staleRead.generation,
			PAGE,
		);

		const currentRead = await adapter.readTopLevelFirstPage(TODO_ID, TODO_COMMENT_SORT.LATEST);
		expect(currentRead.generation).not.toBe(staleRead.generation);
		expect(currentRead.page).toBeUndefined();
	});

	it("같은 generation에 저장한 첫 페이지는 다시 읽는다", async () => {
		const cacheRead = await adapter.readTopLevelFirstPage(TODO_ID, TODO_COMMENT_SORT.POPULAR);
		await adapter.storeTopLevelFirstPageIfCurrent(
			TODO_ID,
			TODO_COMMENT_SORT.POPULAR,
			cacheRead.generation,
			PAGE,
		);

		await expect(
			adapter.readTopLevelFirstPage(TODO_ID, TODO_COMMENT_SORT.POPULAR),
		).resolves.toEqual({ generation: cacheRead.generation, page: PAGE });
	});
});
