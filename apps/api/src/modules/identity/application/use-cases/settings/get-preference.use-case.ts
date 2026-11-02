import type { PreferenceResponse } from "@aido/api";

import type { PreferenceEntitlementPort } from "../../ports/settings/preference-entitlement.port.js";
import { buildPreferenceView } from "../../read-models/settings/preference.read-model.js";
import type { UserPreferenceReader } from "../../services/settings/user-preference-reader.service.js";

export interface GetPreferenceInput {
  readonly userId: string;
}

interface GetPreferenceDependencies {
  readonly preferenceReader: Pick<UserPreferenceReader, "read">;
  readonly entitlement: PreferenceEntitlementPort;
}

export class GetPreference {
  readonly #dependencies: GetPreferenceDependencies;

  constructor(dependencies: GetPreferenceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetPreferenceInput): Promise<PreferenceResponse> {
    const snapshot = await this.#dependencies.preferenceReader.read(input.userId);
    const canCustomizeReminder = await this.#dependencies.entitlement.can(
      input.userId,
      "CUSTOM_REMINDER_TIME",
    );
    return buildPreferenceView(snapshot, canCustomizeReminder);
  }
}
