import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import type { UserPreferenceReadModel } from "../read-models/preference.read-model.js";

export interface GetPreferenceReadModelsQuery {
  readonly userIds: readonly string[];
}

interface GetPreferenceReadModelsDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "listReadModelsByUserIds">;
}

export class GetPreferenceReadModelsUseCase {
  readonly #dependencies: GetPreferenceReadModelsDependencies;

  constructor(dependencies: GetPreferenceReadModelsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetPreferenceReadModelsQuery): Promise<UserPreferenceReadModel[]> {
    return this.#dependencies.preferenceRepository.listReadModelsByUserIds(
      input.userIds.map((userId) => UserId.reconstitute(userId)),
    );
  }
}
