import type { UpdateMarketingPushConsentResponse } from "@aido/api";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { buildMarketingPushConsentView } from "../../../domain/services/settings/consent-view.js";
import { type UserConsentRepositoryPort } from "../../ports/settings/user-consent.repository.port.js";

interface UpdateMarketingPushConsentDependencies {
  readonly consentRepository: UserConsentRepositoryPort;
  readonly logger: ApplicationLogger;
}

export class UpdateMarketingPushConsent {
  readonly #dependencies: UpdateMarketingPushConsentDependencies;

  constructor(dependencies: UpdateMarketingPushConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, agreed: boolean): Promise<UpdateMarketingPushConsentResponse> {
    const updated = await this.#dependencies.consentRepository.upsertMarketingPushConsent(userId, {
      agreed,
    });
    this.#dependencies.logger.log(`광고성 앱 푸시 동의 변경: userId=${userId}, agreed=${agreed}`);
    return buildMarketingPushConsentView(updated);
  }
}
