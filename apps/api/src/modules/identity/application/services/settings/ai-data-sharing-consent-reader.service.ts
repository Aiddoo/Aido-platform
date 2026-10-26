import type { AiDataSharingDecision } from "@aido/api/vocabulary";
import { AI_DATA_SHARING_CONSENT } from "@aido/api/vocabulary";

import { resolveAiDataSharingDecision } from "../../../domain/services/settings/ai-data-sharing-consent-policy.js";
import type { AiDataSharingConsentReaderPort } from "../../ports/settings/ai-data-sharing-consent.reader.port.js";
import type { UserConsentRepositoryPort } from "../../ports/settings/user-consent.repository.port.js";

interface AiDataSharingConsentReaderDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserId">;
}

export class AiDataSharingConsentReader implements AiDataSharingConsentReaderPort {
  readonly #dependencies: AiDataSharingConsentReaderDependencies;

  constructor(dependencies: AiDataSharingConsentReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async findAiDataSharingDecision(userId: string): Promise<AiDataSharingDecision> {
    const consent = await this.#dependencies.consentRepository.findByUserId(userId);
    return resolveAiDataSharingDecision(consent, AI_DATA_SHARING_CONSENT.VERSION);
  }
}
