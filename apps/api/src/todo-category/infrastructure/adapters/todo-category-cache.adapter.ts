import { Injectable } from "@nestjs/common";

import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import type { TodoCategoryWithCountView } from "../../application/ports/todo-category.repository.port";
import type { TodoCategoryCachePort } from "../../application/ports/todo-category-cache.port";

/**
 * TodoCategoryCachePort의 어댑터 — 공유 CacheService에 위임한다(키·TTL은 CacheService가 소유).
 */
@Injectable()
export class TodoCategoryCacheAdapter implements TodoCategoryCachePort {
	constructor(private readonly cacheService: CacheService) {}

	wrapList(
		userId: string,
		factory: () => Promise<TodoCategoryWithCountView[]>,
	): Promise<TodoCategoryWithCountView[]> {
		return this.cacheService.wrapTodoCategories(userId, factory);
	}

	invalidate(userId: string): Promise<void> {
		return this.cacheService.invalidateTodoCategories(userId);
	}
}
