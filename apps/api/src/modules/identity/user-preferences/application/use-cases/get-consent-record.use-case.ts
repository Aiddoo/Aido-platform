import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserConsentRecord } from "../../domain/user-consent.constants.js";
import type { UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";

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
    return this.#dependencies.consentRepository.findByUserId(UserId.reconstitute(input.userId));
  }
}
