import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PreferenceEntitlementPort } from "../ports/preference-entitlement.port.js";
import {
  toPreferenceReadModel,
  type PreferenceReadModel,
} from "../read-models/preference.read-model.js";
import type { ReadUserPreferencesUseCase } from "./read-user-preferences.use-case.js";

export interface GetPreferenceQuery {
  readonly userId: string;
}

interface GetPreferenceDependencies {
  readonly preferenceReader: Pick<ReadUserPreferencesUseCase, "execute">;
  readonly entitlement: PreferenceEntitlementPort;
}

export class GetPreferenceUseCase {
  readonly #dependencies: GetPreferenceDependencies;

  constructor(dependencies: GetPreferenceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetPreferenceQuery): Promise<PreferenceReadModel> {
    const userId = UserId.reconstitute(input.userId);
    const [snapshot, canCustomizeReminder] = await Promise.all([
      this.#dependencies.preferenceReader.execute(userId),
      this.#dependencies.entitlement.can(userId, "CUSTOM_REMINDER_TIME"),
    ]);
    return toPreferenceReadModel(snapshot, canCustomizeReminder);
  }
}
