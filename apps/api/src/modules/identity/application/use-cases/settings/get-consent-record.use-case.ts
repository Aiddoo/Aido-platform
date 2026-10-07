import {
  type UserConsentRecord,
  type UserConsentRepositoryPort,
} from "../../ports/settings/user-consent.repository.port.js";

/** 푸시 발송 판단용 단건 동의 조회 (notification). */
interface GetConsentRecordDependencies {
  readonly consentRepository: UserConsentRepositoryPort;
}

export class GetConsentRecord {
  readonly #dependencies: GetConsentRecordDependencies;

  constructor(dependencies: GetConsentRecordDependencies) {
    this.#dependencies = dependencies;
  }

  execute(userId: string): Promise<UserConsentRecord | null> {
    return this.#dependencies.consentRepository.findByUserId(userId);
  }
}
