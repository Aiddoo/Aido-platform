import { Injectable } from "@nestjs/common";
import { CacheService } from "@/common/cache/cache.service";
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
}
