import { Inject, Injectable } from "@nestjs/common";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";

/**
 * 푸시 토큰 등록 시 타임존 upsert (notification).
 *
 * 새 타임존이 등록되면 스케줄러의 활성 타임존 목록이 스테일해지므로,
 * upsert 후 activeTimezones 캐시를 무효화한다(update-preference와 대칭).
 */
@Injectable()
export class UpsertPushTimezoneUseCase {
	constructor(
		@Inject(USER_PREFERENCE_REPOSITORY)
		private readonly preferenceRepository: UserPreferenceRepositoryPort,
		private readonly cacheService: CacheService,
	) {}

	async execute(userId: string, timezone: string): Promise<void> {
		await this.preferenceRepository.upsertTimezone(userId, timezone);
		await this.cacheService.invalidateActiveTimezones();
	}
}
