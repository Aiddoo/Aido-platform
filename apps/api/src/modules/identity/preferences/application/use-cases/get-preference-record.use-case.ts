import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceRecord } from "../../domain/user-preference.constants.js";
import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";

export interface GetPreferenceRecordQuery {
  readonly userId: string;
}

interface GetPreferenceRecordDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findByUserId">;
}

export class GetPreferenceRecordUseCase {
  readonly #dependencies: GetPreferenceRecordDependencies;

  constructor(dependencies: GetPreferenceRecordDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetPreferenceRecordQuery): Promise<UserPreferenceRecord | null> {
    return this.#dependencies.preferenceRepository.findByUserId(UserId.reconstitute(input.userId));
  }
}
