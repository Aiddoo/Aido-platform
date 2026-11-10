import {
  type AiDataSharingConsentStatus,
  resolveAiDataSharingConsent,
} from "../../domain/ai-data-sharing-consent.domain-service.js";
import type { AiDataSharingConsentReaderPort } from "../ports/ai-data-sharing-consent.reader.port.js";
import type { UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";

interface AiDataSharingConsentReaderDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserId">;
}

export class GetAiDataSharingConsentUseCase implements AiDataSharingConsentReaderPort {
  readonly #dependencies: AiDataSharingConsentReaderDependencies;

  constructor(dependencies: AiDataSharingConsentReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async findAiDataSharingConsent(userId: string): Promise<AiDataSharingConsentStatus> {
    const consent = await this.#dependencies.consentRepository.findByUserId(userId);
    return resolveAiDataSharingConsent(consent);
  }
}
