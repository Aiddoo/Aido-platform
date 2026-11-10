import type { UpdateMarketingConsentResponse } from "@aido/api";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { now } from "#api/shared/domain/date/utils/core";

import { resolveMarketingAgreement } from "../../../domain/services/settings/marketing-consent-policy.js";
import { IdentitySettingsLogEvent } from "../../observability/settings/identity-settings-log.events.js";
import type { UserConsentRepositoryPort } from "../../ports/settings/user-consent.repository.port.js";
import { buildMarketingConsentView } from "../../read-models/settings/consent.read-model.js";

export interface UpdateMarketingConsentInput {
  readonly userId: string;
  readonly agreed: boolean;
}

interface UpdateMarketingConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "upsertMarketingConsent">;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateMarketingConsent {
  readonly #dependencies: UpdateMarketingConsentDependencies;

  constructor(dependencies: UpdateMarketingConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateMarketingConsentInput): Promise<UpdateMarketingConsentResponse> {
    const processedAt = now();
    const updated = await this.#dependencies.consentRepository.upsertMarketingConsent(
      input.userId,
      {
        agreedAt: resolveMarketingAgreement(input.agreed, processedAt),
      },
    );
    this.#dependencies.logger.log({
      event: IdentitySettingsLogEvent.MARKETING_CONSENT_UPDATED,
      userId: input.userId,
      agreed: input.agreed,
    });
    return buildMarketingConsentView(updated, processedAt);
  }
}
