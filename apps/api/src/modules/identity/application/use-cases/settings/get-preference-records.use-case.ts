import {
  type UserPreferenceRecordWithId,
  type UserPreferenceRepositoryPort,
} from "../../ports/settings/user-preference.repository.port.js";

/** 푸시 발송 판단용 배치 설정 조회 (notification). */
interface GetPreferenceRecordsDependencies {
  readonly preferenceRepository: UserPreferenceRepositoryPort;
}

export class GetPreferenceRecords {
  readonly #dependencies: GetPreferenceRecordsDependencies;

  constructor(dependencies: GetPreferenceRecordsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(userIds: string[]): Promise<UserPreferenceRecordWithId[]> {
    return this.#dependencies.preferenceRepository.findByUserIds(userIds);
  }
}
