import type { ConsentResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { buildConsentView } from "../../../domain/services/consent-view";
import {
	USER_CONSENT_REPOSITORY,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";

/**
 * 약관 동의 상태 조회 유스케이스.
 */
@Injectable()
export class GetConsentUseCase {
	constructor(
		@Inject(USER_CONSENT_REPOSITORY)
		private readonly consentRepository: UserConsentRepositoryPort,
	) {}

	async execute(userId: string): Promise<ConsentResponse> {
		const consent = await this.consentRepository.findByUserId(userId);
		return buildConsentView(consent);
	}
}
