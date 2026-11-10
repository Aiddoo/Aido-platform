import { Inject, Injectable } from "@nestjs/common";

import {
  USER_PREFERENCE_READER,
  type UserPreferenceReaderPort,
} from "#api/modules/identity/identity-settings.public";
import { resolveTimezone } from "#api/shared/domain/date/utils/timezone";
import { toSupportedLocale } from "#api/shared/domain/locale";

import type {
  UserLocalePreference,
  UserLocalePreferenceReaderPort,
} from "../../application/ports/user-locale-preference.reader.port.js";

@Injectable()
export class UserLocalePreferenceReader implements UserLocalePreferenceReaderPort {
  readonly #preferenceReader: Pick<UserPreferenceReaderPort, "read">;

  constructor(
    @Inject(USER_PREFERENCE_READER)
    preferenceReader: Pick<UserPreferenceReaderPort, "read">,
  ) {
    this.#preferenceReader = preferenceReader;
  }

  async read(userId: string): Promise<UserLocalePreference> {
    const preference = await this.#preferenceReader.read(userId);
    return {
      timezone: resolveTimezone(preference.timezone),
      locale: toSupportedLocale(preference.locale),
    };
  }
}
