import type { PreferenceResponse } from "@aido/api";

import type { PreferenceEntitlementPort } from "../ports/preference-entitlement.port.js";
import { buildPreferenceView } from "../read-models/preference.read-model.js";
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

  async execute(input: GetPreferenceQuery): Promise<PreferenceResponse> {
    const [snapshot, canCustomizeReminder] = await Promise.all([
      this.#dependencies.preferenceReader.read(input.userId),
      this.#dependencies.entitlement.can(input.userId, "CUSTOM_REMINDER_TIME"),
    ]);
    return buildPreferenceView(snapshot, canCustomizeReminder);
  }
}
