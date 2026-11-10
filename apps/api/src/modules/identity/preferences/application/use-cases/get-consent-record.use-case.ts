import type {
  UserConsentRepositoryPort,
  UserConsentRecord,
} from "../ports/user-consent.repository.port.js";

export interface GetConsentRecordQuery {
  readonly userId: string;
}

interface GetConsentRecordDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserId">;
}

export class GetConsentRecordUseCase {
  readonly #dependencies: GetConsentRecordDependencies;

  constructor(dependencies: GetConsentRecordDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetConsentRecordQuery): Promise<UserConsentRecord | null> {
    return this.#dependencies.consentRepository.findByUserId(input.userId);
  }
}
