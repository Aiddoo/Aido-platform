import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { type UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";
import { buildConsentView, type ConsentView } from "../read-models/consent.read-model.js";

export interface GetConsentQuery {
  readonly userId: string;
}
interface GetConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserId">;
}

export class GetConsentUseCase {
  readonly #dependencies: GetConsentDependencies;

  constructor(dependencies: GetConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetConsentQuery): Promise<ConsentView> {
    const consent = await this.#dependencies.consentRepository.findByUserId(
      UserId.reconstitute(input.userId),
    );
    return buildConsentView(consent);
  }
}
