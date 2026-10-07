import {
  type UserPreferenceRecord,
  type UserPreferenceRepositoryPort,
} from "../../ports/settings/user-preference.repository.port.js";

/** 푸시 발송 판단용 단건 설정 조회 (notification). */
interface GetPreferenceRecordDependencies {
  readonly preferenceRepository: UserPreferenceRepositoryPort;
}

export class GetPreferenceRecord {
  readonly #dependencies: GetPreferenceRecordDependencies;

  constructor(dependencies: GetPreferenceRecordDependencies) {
    this.#dependencies = dependencies;
  }

  execute(userId: string): Promise<UserPreferenceRecord | null> {
    return this.#dependencies.preferenceRepository.findByUserId(userId);
  }
}
