import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import type { UserPreferenceReadModel } from "../read-models/preference.read-model.js";

export interface GetPreferenceReadModelQuery {
  readonly userId: string;
}

interface GetPreferenceReadModelDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findReadModelByUserId">;
}

export class GetPreferenceReadModelUseCase {
  readonly #dependencies: GetPreferenceReadModelDependencies;

  constructor(dependencies: GetPreferenceReadModelDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetPreferenceReadModelQuery): Promise<UserPreferenceReadModel | null> {
    return this.#dependencies.preferenceRepository.findReadModelByUserId(
      UserId.reconstitute(input.userId),
    );
  }
}
