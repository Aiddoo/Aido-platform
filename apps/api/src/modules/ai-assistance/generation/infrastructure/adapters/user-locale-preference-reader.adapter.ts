import { Injectable } from "@nestjs/common";

import { UserPreferenceReaderPort } from "#api/modules/identity/identity-settings.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toSupportedLocale } from "#api/shared/domain/locale";
import { resolveTimezone } from "#api/shared/domain/time/time-zone-name";

import {
  type UserLocalePreference,
  UserLocalePreferenceReaderPort,
} from "../../application/ports/user-locale-preference.reader.port.js";

@Injectable()
export class UserLocalePreferenceReaderAdapter extends UserLocalePreferenceReaderPort {
  readonly #preferenceReader: Pick<UserPreferenceReaderPort, "read">;

  constructor(preferenceReader: UserPreferenceReaderPort) {
    super();
    this.#preferenceReader = preferenceReader;
  }

  async read(userId: UserId): Promise<UserLocalePreference> {
    const preference = await this.#preferenceReader.read(userId);
    return {
      timezone: resolveTimezone(preference.timezone),
      locale: toSupportedLocale(preference.locale),
    };
  }
}
