import {
  type UserConsentRecordWithId,
  type UserConsentRepositoryPort,
} from "../../ports/settings/user-consent.repository.port.js";

/** 푸시 발송 판단용 배치 동의 조회 (notification). */
interface GetConsentRecordsDependencies {
  readonly consentRepository: UserConsentRepositoryPort;
}

export class GetConsentRecords {
  readonly #dependencies: GetConsentRecordsDependencies;

  constructor(dependencies: GetConsentRecordsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(userIds: string[]): Promise<UserConsentRecordWithId[]> {
    return this.#dependencies.consentRepository.findByUserIds(userIds);
  }
}
