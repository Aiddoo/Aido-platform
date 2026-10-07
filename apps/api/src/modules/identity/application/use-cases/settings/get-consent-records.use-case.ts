import type {
  UserConsentRepositoryPort,
  UserConsentRecordWithId,
} from "../../ports/settings/user-consent.repository.port.js";

export interface GetConsentRecordsInput {
  readonly userIds: readonly string[];
}

interface GetConsentRecordsDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserIds">;
}

export class GetConsentRecords {
  readonly #dependencies: GetConsentRecordsDependencies;

  constructor(dependencies: GetConsentRecordsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetConsentRecordsInput): Promise<UserConsentRecordWithId[]> {
    return this.#dependencies.consentRepository.findByUserIds(input.userIds);
  }
}
