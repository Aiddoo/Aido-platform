import { randomUUID } from "node:crypto";

import { TODO_COMMENT_SORT, z, type TodoCommentSort } from "@aido/validators";
import { Injectable } from "@nestjs/common";

import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import type {
	TodoCommentCachePort,
	TodoCommentFirstPageCacheRead,
} from "../../application/ports/todo-comment-cache.port";
import type { PaginatedTodoCommentRecords } from "../../application/types";
import {
	TODO_COMMENT_CACHE_TTL_MS,
	TODO_COMMENT_INITIAL_GENERATION,
	TodoCommentCacheKey,
} from "./todo-comment-cache.keyspace";

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

	async readTopLevelFirstPage(
		todoId: number,
		sort: TodoCommentSort,
	): Promise<TodoCommentFirstPageCacheRead> {
		const generation = await this.getGeneration(todoId);
		const key = TodoCommentCacheKey.topLevelFirstPage(todoId, sort, generation);
		const cached = await this.cacheService.get<unknown>(key);
		const verifiedGeneration = await this.getGeneration(todoId);

		if (verifiedGeneration !== generation) {
			return { generation: verifiedGeneration, page: undefined };
		}

		if (cached === undefined) {
			return { generation, page: undefined };
		}

		const parsed = pageSchema.safeParse(cached);

		if (!parsed.success) {
			await this.cacheService.del(key);
			return { generation, page: undefined };
		}

		return { generation, page: parsed.data };
	}

	async storeTopLevelFirstPageIfCurrent(
		todoId: number,
		sort: TodoCommentSort,
		generation: string,
		page: PaginatedTodoCommentRecords,
	): Promise<void> {
		if ((await this.getGeneration(todoId)) !== generation) {
			return;
		}

		const ttl =
			sort === TODO_COMMENT_SORT.POPULAR
				? TODO_COMMENT_CACHE_TTL_MS.POPULAR_FIRST_PAGE
				: TODO_COMMENT_CACHE_TTL_MS.LATEST_FIRST_PAGE;
		await this.cacheService.set(
			TodoCommentCacheKey.topLevelFirstPage(todoId, sort, generation),
			page,
			ttl,
		);
	}

	async invalidateTopLevelFirstPages(todoId: number): Promise<void> {
		const previousGeneration = await this.getGeneration(todoId);
		await this.cacheService.set(
			TodoCommentCacheKey.generation(todoId),
			randomUUID(),
			TODO_COMMENT_CACHE_TTL_MS.GENERATION,
		);

		await Promise.all([
			this.cacheService.delByPattern(
				TodoCommentCacheKey.firstPageGenerationPattern(todoId, previousGeneration),
			),
			this.cacheService.delByPattern(TodoCommentCacheKey.legacyFirstPagePattern(todoId)),
		]);
	}

	private async getGeneration(todoId: number): Promise<string> {
		return (
			(await this.cacheService.get<string>(TodoCommentCacheKey.generation(todoId))) ??
			TODO_COMMENT_INITIAL_GENERATION
		);
	}
}
