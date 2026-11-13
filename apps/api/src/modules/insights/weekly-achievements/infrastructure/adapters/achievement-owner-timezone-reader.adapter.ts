import { Injectable } from "@nestjs/common";

import { UserPreferenceReaderPort } from "#api/modules/identity/identity-settings.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AchievementOwnerTimezoneReaderPort } from "../../application/ports/achievement-owner-timezone.reader.port.js";

@Injectable()
export class AchievementOwnerTimezoneReaderAdapter extends AchievementOwnerTimezoneReaderPort {
  readonly #preferenceReader: Pick<UserPreferenceReaderPort, "read">;

  constructor(preferenceReader: UserPreferenceReaderPort) {
    super();
    this.#preferenceReader = preferenceReader;
  }

  async read(userId: UserId): Promise<string> {
    const preference = await this.#preferenceReader.read(userId);
    return preference.timezone;
  }
}
