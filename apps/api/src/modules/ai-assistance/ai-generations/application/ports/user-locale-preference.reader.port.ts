import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserLocalePreferenceReadModel } from "../read-models/user-locale-preference.read-model.js";

export abstract class UserLocalePreferenceReaderPort {
  abstract read(userId: UserId): Promise<UserLocalePreferenceReadModel>;
}
