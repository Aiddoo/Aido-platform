import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";
import type { UserConsentReadModel } from "../read-models/consent.read-model.js";

export interface GetConsentReadModelQuery {
  readonly userId: string;
}

interface GetConsentReadModelDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserId">;
}

export class GetConsentReadModelUseCase {
  readonly #dependencies: GetConsentReadModelDependencies;

  constructor(dependencies: GetConsentReadModelDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetConsentReadModelQuery): Promise<UserConsentReadModel | null> {
    return this.#dependencies.consentRepository.findByUserId(UserId.reconstitute(input.userId));
  }
}
