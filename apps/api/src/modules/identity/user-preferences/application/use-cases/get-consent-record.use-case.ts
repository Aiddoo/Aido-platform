import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";
import type { UserConsentReadModel } from "../read-models/consent.read-model.js";

export interface GetConsentRecordQuery {
  readonly userId: string;
}

interface GetConsentRecordDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserId">;
}

export class GetConsentRecordUseCase {
  readonly #dependencies: GetConsentRecordDependencies;

  constructor(dependencies: GetConsentRecordDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetConsentRecordQuery): Promise<UserConsentReadModel | null> {
    return this.#dependencies.consentRepository.findByUserId(UserId.reconstitute(input.userId));
  }
}
