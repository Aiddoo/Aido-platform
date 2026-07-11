import { Inject, Injectable } from "@nestjs/common";

import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";

/** 푸시 토큰 등록 시 로케일 upsert (notification). */
@Injectable()
export class UpsertPushLocaleUseCase {
	constructor(
		@Inject(USER_PREFERENCE_REPOSITORY)
		private readonly preferenceRepository: UserPreferenceRepositoryPort,
	) {}

	execute(userId: string, locale: string): Promise<void> {
		return this.preferenceRepository.upsertLocale(userId, locale);
	}
}
