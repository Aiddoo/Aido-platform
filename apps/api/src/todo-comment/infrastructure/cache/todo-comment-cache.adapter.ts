import { TODO_COMMENT_SORT, z, type TodoCommentSort } from "@aido/validators";
import { Injectable } from "@nestjs/common";

import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import type { TodoCommentCachePort } from "../../application/ports/todo-comment-cache.port";
import type { PaginatedTodoCommentRecords } from "../../application/types";
import { TODO_COMMENT_CACHE_TTL_MS, TodoCommentCacheKey } from "./todo-comment-cache.keyspace";

const commentRecordSchema: z.ZodType<PaginatedTodoCommentRecords["items"][number]> = z.lazy(() =>
	z.object({
		id: z.cuid(),
		todoId: z.number().int().positive(),
		parentId: z.cuid().nullable(),
		rootId: z.cuid().nullable(),
		path: z.array(z.cuid()),
		depth: z.number().int().nonnegative(),
		parentAuthorName: z.string().nullable(),
		authorId: z.cuid(),
		authorName: z.string().nullable(),
		authorProfileImage: z.string().nullable(),
		todoOwnerId: z.cuid(),
		content: z.string().nullable(),
		likeCount: z.number().int().nonnegative(),
		replyCount: z.number().int().nonnegative(),
		deletedAt: z.iso.datetime().nullable(),
		editedAt: z.iso.datetime().nullable(),
		createdAt: z.iso.datetime(),
		children: z.array(commentRecordSchema),
	}),
);

const pageSchema = z.object({
	items: z.array(commentRecordSchema),
	nextCursor: z.string().nullable(),
	hasNext: z.boolean(),
	size: z.number().int().positive(),
});

@Injectable()
export class TodoCommentCacheAdapter implements TodoCommentCachePort {
	constructor(private readonly cacheService: CacheService) {}

	async getTopLevelFirstPage(
		todoId: number,
		sort: TodoCommentSort,
	): Promise<PaginatedTodoCommentRecords | undefined> {
		const key = TodoCommentCacheKey.topLevelFirstPage(todoId, sort);
		const cached = await this.cacheService.get<unknown>(key);

		if (cached === undefined) {
			return undefined;
		}

		const parsed = pageSchema.safeParse(cached);

		if (!parsed.success) {
			await this.cacheService.del(key);
			return undefined;
		}

		return parsed.data;
	}

	async setTopLevelFirstPage(
		todoId: number,
		sort: TodoCommentSort,
		page: PaginatedTodoCommentRecords,
	): Promise<void> {
		const ttl =
			sort === TODO_COMMENT_SORT.POPULAR
				? TODO_COMMENT_CACHE_TTL_MS.POPULAR_FIRST_PAGE
				: TODO_COMMENT_CACHE_TTL_MS.LATEST_FIRST_PAGE;
		await this.cacheService.set(TodoCommentCacheKey.topLevelFirstPage(todoId, sort), page, ttl);
	}

	async invalidateTopLevelFirstPages(todoId: number): Promise<void> {
		await Promise.all([
			this.cacheService.del(
				TodoCommentCacheKey.topLevelFirstPage(todoId, TODO_COMMENT_SORT.POPULAR),
			),
			this.cacheService.del(
				TodoCommentCacheKey.topLevelFirstPage(todoId, TODO_COMMENT_SORT.LATEST),
			),
		]);
	}
}
