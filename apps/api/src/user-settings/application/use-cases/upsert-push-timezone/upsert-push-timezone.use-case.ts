import { Inject, Injectable } from "@nestjs/common";

import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";

/** 푸시 토큰 등록 시 타임존 upsert (notification). */
@Injectable()
export class UpsertPushTimezoneUseCase {
	constructor(
		@Inject(USER_PREFERENCE_REPOSITORY)
		private readonly preferenceRepository: UserPreferenceRepositoryPort,
	) {}

	execute(userId: string, timezone: string): Promise<void> {
		return this.preferenceRepository.upsertTimezone(userId, timezone);
	}
}
