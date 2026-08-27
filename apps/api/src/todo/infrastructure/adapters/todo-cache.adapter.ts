import { randomUUID } from "node:crypto";

import type { Todo as TodoResponse } from "@aido/validators";
import { Injectable } from "@nestjs/common";

import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import type {
	FriendTodosFirstPageCacheRead,
	TodoCachePort,
} from "../../application/ports/todo-cache.port";
import {
	FRIEND_TODOS_INITIAL_GENERATION,
	TODO_CACHE_TTL_MS,
	TodoCacheKey,
} from "../cache/todo-cache.keyspace";

/**
 * Todo 캐시 포트 어댑터 — CacheService에 위임
 */
@Injectable()
export class TodoCacheAdapter implements TodoCachePort {
	constructor(private readonly cacheService: CacheService) {}

	async invalidateTodoCategories(userId: string): Promise<void> {
		await this.cacheService.invalidateTodoCategories(userId);
	}

	async readFriendTodosFirstPage(
		ownerUserId: string,
		startDate: string,
		endDate: string,
		size: number,
	): Promise<FriendTodosFirstPageCacheRead> {
		const generation = await this.getFriendTodosGeneration(ownerUserId);
		const page = await this.cacheService.get<CursorPaginatedResponse<TodoResponse, number>>(
			TodoCacheKey.friendTodosFirstPageVersioned(ownerUserId, generation, startDate, endDate, size),
		);
		// page GET이 끝난 뒤 다시 읽어야 둘 사이의 invalidate를 반드시 관측한다.
		const verifiedGeneration = await this.getFriendTodosGeneration(ownerUserId);

		// generation이 바뀐 동안 읽은 이전 페이지는 cache miss로 취급한다.
		if (verifiedGeneration !== generation) {
			return { generation: verifiedGeneration, page: undefined };
		}

		return { generation, page };
	}

	async storeFriendTodosFirstPageIfCurrent(
		ownerUserId: string,
		startDate: string,
		endDate: string,
		size: number,
		generation: string,
		page: CursorPaginatedResponse<TodoResponse, number>,
	): Promise<void> {
		const currentGeneration = await this.getFriendTodosGeneration(ownerUserId);
		if (currentGeneration !== generation) {
			return;
		}

		// 확인 직후 invalidate가 와도 이전 generation 키에만 저장되어 새 reader에는 보이지 않는다.
		await this.cacheService.set(
			TodoCacheKey.friendTodosFirstPageVersioned(ownerUserId, generation, startDate, endDate, size),
			page,
			TODO_CACHE_TTL_MS.FRIEND_VIEW,
		);
	}

	async invalidateFriendTodos(ownerUserId: string): Promise<void> {
		const previousGeneration = await this.getFriendTodosGeneration(ownerUserId);

		// 먼저 generation을 회전해야 진행 중인 reader가 이전 페이지를 다시 채워도 보이지 않는다.
		await this.cacheService.set(
			TodoCacheKey.friendTodosGeneration(ownerUserId),
			randomUUID(),
			TODO_CACHE_TTL_MS.FRIEND_VIEW_GENERATION,
		);

		await Promise.all([
			this.cacheService.delByPattern(
				TodoCacheKey.friendTodosGenerationPattern(ownerUserId, previousGeneration),
			),
			// v1은 더 이상 읽지 않지만 롤링 배포 중인 이전 인스턴스와 잔존 키를 함께 정리한다.
			this.cacheService.delByPattern(TodoCacheKey.friendTodosPattern(ownerUserId)),
		]);
	}

	private async getFriendTodosGeneration(ownerUserId: string): Promise<string> {
		return (
			(await this.cacheService.get<string>(TodoCacheKey.friendTodosGeneration(ownerUserId))) ??
			FRIEND_TODOS_INITIAL_GENERATION
		);
	}
}
