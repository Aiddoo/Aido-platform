import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PreferenceEntitlementPort } from "../ports/preference-entitlement.port.js";
import { buildPreferenceView, type PreferenceView } from "../read-models/preference.read-model.js";
import type { ReadUserPreferencesUseCase } from "./read-user-preferences.use-case.js";

export interface GetPreferenceQuery {
  readonly userId: string;
}

interface GetPreferenceDependencies {
  readonly preferenceReader: Pick<ReadUserPreferencesUseCase, "read">;
  readonly entitlement: PreferenceEntitlementPort;
}

export class GetPreferenceUseCase {
  readonly #dependencies: GetPreferenceDependencies;

  constructor(dependencies: GetPreferenceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetPreferenceQuery): Promise<PreferenceView> {
    const [snapshot, canCustomizeReminder] = await Promise.all([
      this.#dependencies.preferenceReader.read(input.userId),
      this.#dependencies.entitlement.can(UserId.reconstitute(input.userId), "CUSTOM_REMINDER_TIME"),
    ]);
    return buildPreferenceView(snapshot, canCustomizeReminder);
  }
}
