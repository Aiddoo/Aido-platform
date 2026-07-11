import type { Todo as TodoResponse } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { CacheKeys } from "@/shared/infrastructure/cache/constants/cache-keys";
import type { TodoCachePort } from "../../application/ports/todo-cache.port";

/**
 * Todo 캐시 포트 어댑터 — CacheService에 위임
 */
@Injectable()
export class TodoCacheAdapter implements TodoCachePort {
	constructor(private readonly cacheService: CacheService) {}

	async invalidateTodoCategories(userId: string): Promise<void> {
		await this.cacheService.invalidateTodoCategories(userId);
	}

	async getFriendTodosFirstPage(
		ownerUserId: string,
		startDate: string,
		endDate: string,
		size: number,
	): Promise<CursorPaginatedResponse<TodoResponse, number> | undefined> {
		return this.cacheService.get<CursorPaginatedResponse<TodoResponse, number>>(
			CacheKeys.friendTodosFirstPage(ownerUserId, startDate, endDate, size),
		);
	}

	async setFriendTodosFirstPage(
		ownerUserId: string,
		startDate: string,
		endDate: string,
		size: number,
		page: CursorPaginatedResponse<TodoResponse, number>,
	): Promise<void> {
		await this.cacheService.set(
			CacheKeys.friendTodosFirstPage(ownerUserId, startDate, endDate, size),
			page,
			CacheKeys.TTL.TODO_FRIEND_VIEW,
		);
	}

	async invalidateFriendTodos(ownerUserId: string): Promise<void> {
		await this.cacheService.delByPattern(
			CacheKeys.friendTodosPattern(ownerUserId),
		);
	}
}
