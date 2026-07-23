import { Inject, Injectable } from "@nestjs/common";
import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";
import {
	USER_SETTINGS_CACHE,
	type UserSettingsCachePort,
} from "../../ports/user-settings-cache.port";

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
		@Inject(USER_SETTINGS_CACHE)
		private readonly cache: UserSettingsCachePort,
	) {}

	async execute(userId: string, timezone: string): Promise<void> {
		await this.preferenceRepository.upsertTimezone(userId, timezone);
		await this.cache.invalidateActiveTimezones();
	}
}
