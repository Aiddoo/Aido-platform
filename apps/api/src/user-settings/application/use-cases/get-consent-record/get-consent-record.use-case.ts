import { Inject, Injectable } from "@nestjs/common";

import {
	USER_CONSENT_REPOSITORY,
	type UserConsentRecord,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";

/** 푸시 발송 판단용 단건 동의 조회 (notification). */
@Injectable()
export class GetConsentRecordUseCase {
	constructor(
		@Inject(USER_CONSENT_REPOSITORY)
		private readonly consentRepository: UserConsentRepositoryPort,
	) {}

	execute(userId: string): Promise<UserConsentRecord | null> {
		return this.consentRepository.findByUserId(userId);
	}
}
