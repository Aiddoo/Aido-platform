import type {
  UserPreferenceRepositoryPort,
  UserPreferenceRecordWithId,
} from "../../ports/settings/user-preference.repository.port.js";

export interface GetPreferenceRecordsInput {
  readonly userIds: readonly string[];
}

interface GetPreferenceRecordsDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findByUserIds">;
}

export class GetPreferenceRecords {
  readonly #dependencies: GetPreferenceRecordsDependencies;

  constructor(dependencies: GetPreferenceRecordsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetPreferenceRecordsInput): Promise<UserPreferenceRecordWithId[]> {
    return this.#dependencies.preferenceRepository.findByUserIds(input.userIds);
  }
}
