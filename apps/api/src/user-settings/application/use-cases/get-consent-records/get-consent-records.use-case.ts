import { Inject, Injectable } from "@nestjs/common";

import {
	USER_CONSENT_REPOSITORY,
	type UserConsentRecordWithId,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";

/** 푸시 발송 판단용 배치 동의 조회 (notification). */
@Injectable()
export class GetConsentRecordsUseCase {
	constructor(
		@Inject(USER_CONSENT_REPOSITORY)
		private readonly consentRepository: UserConsentRepositoryPort,
	) {}

	execute(userIds: string[]): Promise<UserConsentRecordWithId[]> {
		return this.consentRepository.findByUserIds(userIds);
	}
}
