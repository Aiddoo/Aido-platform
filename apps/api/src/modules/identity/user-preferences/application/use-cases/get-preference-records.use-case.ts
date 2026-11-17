import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import type { UserPreferenceReadModel } from "../read-models/preference.read-model.js";

export interface GetPreferenceRecordsQuery {
  readonly userIds: readonly string[];
}

interface GetPreferenceRecordsDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findReadModelsByUserIds">;
}

export class GetPreferenceRecordsUseCase {
  readonly #dependencies: GetPreferenceRecordsDependencies;

  constructor(dependencies: GetPreferenceRecordsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetPreferenceRecordsQuery): Promise<UserPreferenceReadModel[]> {
    return this.#dependencies.preferenceRepository.findReadModelsByUserIds(
      input.userIds.map((userId) => UserId.reconstitute(userId)),
    );
  }
}
