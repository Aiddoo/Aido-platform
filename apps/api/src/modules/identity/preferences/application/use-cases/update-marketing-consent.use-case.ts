import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { resolveMarketingAgreement } from "../../domain/marketing-consent.domain-service.js";
import type { UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";
import { PreferenceLogEvent } from "../preferences.log-events.js";
import {
  buildMarketingConsentView,
  type MarketingConsentView,
} from "../read-models/consent.read-model.js";

export interface UpdateMarketingConsentCommand {
  readonly userId: string;
  readonly agreed: boolean;
}

interface UpdateMarketingConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "upsertMarketingConsent">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateMarketingConsentUseCase {
  readonly #dependencies: UpdateMarketingConsentDependencies;

  constructor(dependencies: UpdateMarketingConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateMarketingConsentCommand): Promise<MarketingConsentView> {
    const processedAt = this.#dependencies.clock.now();
    const updated = await this.#dependencies.consentRepository.upsertMarketingConsent(
      input.userId,
      {
        agreedAt: resolveMarketingAgreement(input.agreed, processedAt),
      },
    );
    this.#dependencies.logger.log({
      event: PreferenceLogEvent.MARKETING_CONSENT_UPDATED,
      userId: input.userId,
      agreed: input.agreed,
    });
    return buildMarketingConsentView(updated, processedAt);
  }
}
