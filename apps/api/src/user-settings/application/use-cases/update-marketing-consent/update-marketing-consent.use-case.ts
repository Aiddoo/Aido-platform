import type { UpdateMarketingConsentResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { buildMarketingConsentView } from "../../../domain/services/consent-view";

import {
	USER_CONSENT_REPOSITORY,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";

/**
 * 마케팅 수신 동의 변경 유스케이스.
 */
@Injectable()
export class UpdateMarketingConsentUseCase {
	readonly #logger = new Logger(UpdateMarketingConsentUseCase.name);

	constructor(
		@Inject(USER_CONSENT_REPOSITORY)
		private readonly consentRepository: UserConsentRepositoryPort,
	) {}

	async execute(
		userId: string,
		agreed: boolean,
	): Promise<UpdateMarketingConsentResponse> {
		const updated = await this.consentRepository.upsertMarketingConsent(
			userId,
			{
				agreed,
			},
		);

		this.#logger.log(
			`User ${userId} updated marketing consent: agreed=${agreed}`,
		);

		return buildMarketingConsentView(updated);
	}
}
