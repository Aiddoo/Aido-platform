import { Injectable } from "@nestjs/common";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { CacheKeys } from "@/shared/infrastructure/cache/constants/cache-keys";
import type { DailyCompletionCachePort } from "../../application/ports/daily-completion-cache.port";
import type { DailyCompletionsRange } from "../../domain/daily-completion";

/**
 * DailyCompletionCachePort 어댑터 — 공유 CacheService(중앙 관리 CacheKeys)에 위임.
 * 키 스킴(daily-completion:range:v1:*)과 TTL(DAILY_COMPLETIONS)은 CacheKeys가 소유한다.
 */
@Injectable()
export class DailyCompletionCacheAdapter implements DailyCompletionCachePort {
	constructor(private readonly cacheService: CacheService) {}

	getRange(
		userId: string,
		startDate: string,
		endDate: string,
	): Promise<DailyCompletionsRange | undefined> {
		return this.cacheService.get<DailyCompletionsRange>(
			CacheKeys.dailyCompletionRange(userId, startDate, endDate),
		);
	}

	setRange(
		userId: string,
		startDate: string,
		endDate: string,
		value: DailyCompletionsRange,
	): Promise<void> {
		return this.cacheService.set(
			CacheKeys.dailyCompletionRange(userId, startDate, endDate),
			value,
			CacheKeys.TTL.DAILY_COMPLETIONS,
		);
	}

	getPublicRange(
		ownerUserId: string,
		startDate: string,
		endDate: string,
	): Promise<DailyCompletionsRange | undefined> {
		return this.cacheService.get<DailyCompletionsRange>(
			CacheKeys.dailyCompletionPublicRange(ownerUserId, startDate, endDate),
		);
	}

	setPublicRange(
		ownerUserId: string,
		startDate: string,
		endDate: string,
		value: DailyCompletionsRange,
	): Promise<void> {
		return this.cacheService.set(
			CacheKeys.dailyCompletionPublicRange(ownerUserId, startDate, endDate),
			value,
			CacheKeys.TTL.DAILY_COMPLETIONS,
		);
	}

	async invalidate(userId: string): Promise<void> {
		await this.cacheService.delByPattern(
			CacheKeys.dailyCompletionPattern(userId),
		);
	}
}
