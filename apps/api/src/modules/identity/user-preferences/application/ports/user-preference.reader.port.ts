import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PreferenceSettingsReadModel } from "../read-models/preference.read-model.js";

export abstract class UserPreferenceReaderPort {
  abstract read(userId: UserId): Promise<PreferenceSettingsReadModel>;
}
