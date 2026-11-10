import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { resolveMarketingAgreement } from "../../domain/marketing-consent.domain-service.js";
import type { UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";
import { PreferenceLogEvent } from "../preferences.log-events.js";
import {
  buildMarketingPushConsentView,
  type MarketingPushConsentView,
} from "../read-models/consent.read-model.js";

export interface UpdateMarketingPushConsentCommand {
  readonly userId: string;
  readonly agreed: boolean;
}

interface UpdateMarketingPushConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "upsertMarketingPushConsent">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateMarketingPushConsentUseCase {
  readonly #dependencies: UpdateMarketingPushConsentDependencies;

  constructor(dependencies: UpdateMarketingPushConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateMarketingPushConsentCommand): Promise<MarketingPushConsentView> {
    const processedAt = this.#dependencies.clock.now();
    const updated = await this.#dependencies.consentRepository.upsertMarketingPushConsent(
      input.userId,
      {
        agreedAt: resolveMarketingAgreement(input.agreed, processedAt),
      },
    );
    this.#dependencies.logger.log({
      event: PreferenceLogEvent.MARKETING_PUSH_CONSENT_UPDATED,
      userId: input.userId,
      agreed: input.agreed,
    });
    return buildMarketingPushConsentView(updated, processedAt);
  }
}
