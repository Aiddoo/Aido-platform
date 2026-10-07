import type {
  UserConsentRepositoryPort,
  UserConsentRecord,
} from "../../ports/settings/user-consent.repository.port.js";

export interface GetConsentRecordInput {
  readonly userId: string;
}

interface GetConsentRecordDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserId">;
}

export class GetConsentRecord {
  readonly #dependencies: GetConsentRecordDependencies;

  constructor(dependencies: GetConsentRecordDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetConsentRecordInput): Promise<UserConsentRecord | null> {
    return this.#dependencies.consentRepository.findByUserId(input.userId);
  }
}
