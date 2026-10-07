import type { ConsentResponse } from "@aido/api";

import { type UserConsentRepositoryPort } from "../../ports/settings/user-consent.repository.port.js";
import { buildConsentView } from "../../read-models/settings/consent.read-model.js";

export interface GetConsentInput {
  readonly userId: string;
}
interface GetConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserId">;
}

export class GetConsent {
  readonly #dependencies: GetConsentDependencies;

  constructor(dependencies: GetConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetConsentInput): Promise<ConsentResponse> {
    const consent = await this.#dependencies.consentRepository.findByUserId(input.userId);
    return buildConsentView(consent);
  }
}
