import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserPreferenceReaderPort } from "../../application/ports/user-preference.reader.port.js";
import type { PreferenceSettingsReadModel } from "../../application/read-models/preference.read-model.js";
import { ReadUserPreferencesUseCase } from "../../application/use-cases/read-user-preferences.use-case.js";

@Injectable()
export class UserPreferenceReaderAdapter extends UserPreferenceReaderPort {
  readonly #readUserPreferences: Pick<ReadUserPreferencesUseCase, "execute">;

  constructor(readUserPreferences: ReadUserPreferencesUseCase) {
    super();
    this.#readUserPreferences = readUserPreferences;
  }

  read(userId: UserId): Promise<PreferenceSettingsReadModel> {
    return this.#readUserPreferences.execute(userId);
  }
}
