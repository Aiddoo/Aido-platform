import { Inject, Injectable } from "@nestjs/common";

import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRecordWithId,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";

/** 푸시 발송 판단용 배치 설정 조회 (notification). */
@Injectable()
export class GetPreferenceRecordsUseCase {
	constructor(
		@Inject(USER_PREFERENCE_REPOSITORY)
		private readonly preferenceRepository: UserPreferenceRepositoryPort,
	) {}

	execute(userIds: string[]): Promise<UserPreferenceRecordWithId[]> {
		return this.preferenceRepository.findByUserIds(userIds);
	}
}
