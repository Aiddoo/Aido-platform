import type { UpdateMarketingPushConsentResponse } from "@aido/api";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";

import { resolveMarketingAgreement } from "../../../domain/services/settings/marketing-consent-policy.js";
import { IdentitySettingsLogEvent } from "../../observability/settings/identity-settings-log.events.js";
import type { UserConsentRepositoryPort } from "../../ports/settings/user-consent.repository.port.js";
import { buildMarketingPushConsentView } from "../../read-models/settings/consent.read-model.js";

export interface UpdateMarketingPushConsentInput {
  readonly userId: string;
  readonly agreed: boolean;
}

interface UpdateMarketingPushConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "upsertMarketingPushConsent">;
  readonly logger: ApplicationLogger;
}

export class UpdateMarketingPushConsent {
  readonly #dependencies: UpdateMarketingPushConsentDependencies;

  constructor(dependencies: UpdateMarketingPushConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    input: UpdateMarketingPushConsentInput,
  ): Promise<UpdateMarketingPushConsentResponse> {
    const updated = await this.#dependencies.consentRepository.upsertMarketingPushConsent(
      input.userId,
      {
        agreedAt: resolveMarketingAgreement(input.agreed, now()),
      },
    );
    this.#dependencies.logger.log({
      event: IdentitySettingsLogEvent.MARKETING_PUSH_CONSENT_UPDATED,
      userId: input.userId,
      agreed: input.agreed,
    });
    return buildMarketingPushConsentView(updated);
  }
}
