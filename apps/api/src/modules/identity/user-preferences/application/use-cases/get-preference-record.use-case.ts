import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import type { UserPreferenceReadModel } from "../read-models/preference.read-model.js";

export interface GetPreferenceRecordQuery {
  readonly userId: string;
}

interface GetPreferenceRecordDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findReadModelByUserId">;
}

export class GetPreferenceRecordUseCase {
  readonly #dependencies: GetPreferenceRecordDependencies;

  constructor(dependencies: GetPreferenceRecordDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetPreferenceRecordQuery): Promise<UserPreferenceReadModel | null> {
    return this.#dependencies.preferenceRepository.findReadModelByUserId(
      UserId.reconstitute(input.userId),
    );
  }
}
