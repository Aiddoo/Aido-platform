import type { UpdateMarketingPushConsentResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { buildMarketingPushConsentView } from "../../../domain/services/consent-view";
import {
	USER_CONSENT_REPOSITORY,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";

@Injectable()
export class UpdateMarketingPushConsentUseCase {
	readonly #logger = new Logger(UpdateMarketingPushConsentUseCase.name);

	constructor(
		@Inject(USER_CONSENT_REPOSITORY)
		private readonly consentRepository: UserConsentRepositoryPort,
	) {}

	async execute(
		userId: string,
		agreed: boolean,
	): Promise<UpdateMarketingPushConsentResponse> {
		const updated = await this.consentRepository.upsertMarketingPushConsent(
			userId,
			{ agreed },
		);
		this.#logger.log(
			`광고성 앱 푸시 동의 변경: userId=${userId}, agreed=${agreed}`,
		);
		return buildMarketingPushConsentView(updated);
	}
}
