import {
  type AiDataSharingConsentStatus,
  resolveAiDataSharingConsent,
} from "../../../domain/services/settings/ai-data-sharing-consent-policy.js";
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

  async findAiDataSharingConsent(userId: string): Promise<AiDataSharingConsentStatus> {
    const consent = await this.#dependencies.consentRepository.findByUserId(userId);
    return resolveAiDataSharingConsent(consent);
  }
}
