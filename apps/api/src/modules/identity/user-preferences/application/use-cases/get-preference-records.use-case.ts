import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  UserPreferenceRepositoryPort,
  UserPreferenceRecordWithId,
} from "../ports/user-preference.repository.port.js";

export interface GetPreferenceRecordsQuery {
  readonly userIds: readonly string[];
}

interface GetPreferenceRecordsDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findByUserIds">;
}

export class GetPreferenceRecordsUseCase {
  readonly #dependencies: GetPreferenceRecordsDependencies;

  constructor(dependencies: GetPreferenceRecordsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetPreferenceRecordsQuery): Promise<UserPreferenceRecordWithId[]> {
    return this.#dependencies.preferenceRepository.findByUserIds(
      input.userIds.map((userId) => UserId.reconstitute(userId)),
    );
  }
}
