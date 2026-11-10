import type {
  UserConsentRepositoryPort,
  UserConsentRecordWithId,
} from "../ports/user-consent.repository.port.js";

export interface GetConsentRecordsQuery {
  readonly userIds: readonly string[];
}

interface GetConsentRecordsDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserIds">;
}

export class GetConsentRecordsUseCase {
  readonly #dependencies: GetConsentRecordsDependencies;

  constructor(dependencies: GetConsentRecordsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetConsentRecordsQuery): Promise<UserConsentRecordWithId[]> {
    return this.#dependencies.consentRepository.findByUserIds(input.userIds);
  }
}
