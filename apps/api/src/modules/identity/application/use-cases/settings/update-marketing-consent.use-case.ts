import type { UpdateMarketingConsentResponse } from "@aido/api";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { buildMarketingConsentView } from "../../../domain/services/settings/consent-view.js";
import { type UserConsentRepositoryPort } from "../../ports/settings/user-consent.repository.port.js";

/**
 * 마케팅 수신 동의 변경 유스케이스.
 */
interface UpdateMarketingConsentDependencies {
  readonly consentRepository: UserConsentRepositoryPort;
  readonly logger: ApplicationLogger;
}

export class UpdateMarketingConsent {
  readonly #dependencies: UpdateMarketingConsentDependencies;

  constructor(dependencies: UpdateMarketingConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, agreed: boolean): Promise<UpdateMarketingConsentResponse> {
    const updated = await this.#dependencies.consentRepository.upsertMarketingConsent(userId, {
      agreed,
    });

    this.#dependencies.logger.log(`User ${userId} updated marketing consent: agreed=${agreed}`);

    return buildMarketingConsentView(updated);
  }
}
