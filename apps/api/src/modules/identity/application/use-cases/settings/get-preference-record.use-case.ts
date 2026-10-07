import type {
  UserPreferenceRepositoryPort,
  UserPreferenceRecord,
} from "../../ports/settings/user-preference.repository.port.js";

export interface GetPreferenceRecordInput {
  readonly userId: string;
}

interface GetPreferenceRecordDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findByUserId">;
}

export class GetPreferenceRecord {
  readonly #dependencies: GetPreferenceRecordDependencies;

  constructor(dependencies: GetPreferenceRecordDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetPreferenceRecordInput): Promise<UserPreferenceRecord | null> {
    return this.#dependencies.preferenceRepository.findByUserId(input.userId);
  }
}
