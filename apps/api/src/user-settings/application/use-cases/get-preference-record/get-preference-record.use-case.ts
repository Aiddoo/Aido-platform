import { Inject, Injectable } from "@nestjs/common";

import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRecord,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";

/** 푸시 발송 판단용 단건 설정 조회 (notification). */
@Injectable()
export class GetPreferenceRecordUseCase {
	constructor(
		@Inject(USER_PREFERENCE_REPOSITORY)
		private readonly preferenceRepository: UserPreferenceRepositoryPort,
	) {}

	execute(userId: string): Promise<UserPreferenceRecord | null> {
		return this.preferenceRepository.findByUserId(userId);
	}
}
