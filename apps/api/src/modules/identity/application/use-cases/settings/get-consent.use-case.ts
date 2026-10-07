import type { ConsentResponse } from "@aido/api";

import { buildConsentView } from "../../../domain/services/settings/consent-view.js";
import { type UserConsentRepositoryPort } from "../../ports/settings/user-consent.repository.port.js";

/**
 * 약관 동의 상태 조회 유스케이스.
 */
interface GetConsentDependencies {
  readonly consentRepository: UserConsentRepositoryPort;
}

export class GetConsent {
  readonly #dependencies: GetConsentDependencies;

  constructor(dependencies: GetConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string): Promise<ConsentResponse> {
    const consent = await this.#dependencies.consentRepository.findByUserId(userId);
    return buildConsentView(consent);
  }
}
