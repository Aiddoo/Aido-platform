import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";
import type { UserConsentReadModel } from "../read-models/consent.read-model.js";

export interface GetConsentReadModelsQuery {
  readonly userIds: readonly string[];
}

interface GetConsentReadModelsDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "listByUserIds">;
}

export class GetConsentReadModelsUseCase {
  readonly #dependencies: GetConsentReadModelsDependencies;

  constructor(dependencies: GetConsentReadModelsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetConsentReadModelsQuery): Promise<UserConsentReadModel[]> {
    return this.#dependencies.consentRepository.listByUserIds(
      input.userIds.map((userId) => UserId.reconstitute(userId)),
    );
  }
}
