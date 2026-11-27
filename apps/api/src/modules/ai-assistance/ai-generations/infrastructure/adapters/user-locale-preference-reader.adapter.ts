import { resolveSupportedLocale } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";

import { UserPreferenceReaderPort } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { resolveDateBoundaryTimezone } from "#api/shared/domain/time/timezone-name";

import { UserLocalePreferenceReaderPort } from "../../application/ports/user-locale-preference.reader.port.js";
import type { UserLocalePreferenceReadModel } from "../../application/read-models/user-locale-preference.read-model.js";

@Injectable()
export class UserLocalePreferenceReaderAdapter extends UserLocalePreferenceReaderPort {
  readonly #preferenceReader: Pick<UserPreferenceReaderPort, "read">;

  constructor(preferenceReader: UserPreferenceReaderPort) {
    super();
    this.#preferenceReader = preferenceReader;
  }

  async read(userId: UserId): Promise<UserLocalePreferenceReadModel> {
    const preference = await this.#preferenceReader.read(userId);
    return {
      timezone: resolveDateBoundaryTimezone(preference.timezone),
      locale: resolveSupportedLocale(preference.locale),
    };
  }
}
