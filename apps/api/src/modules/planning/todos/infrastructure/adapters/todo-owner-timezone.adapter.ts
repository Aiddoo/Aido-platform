import { Inject, Injectable } from "@nestjs/common";

import {
  USER_TIMEZONE_READER,
  type UserTimezoneReaderPort,
} from "#api/modules/identity/identity-settings.public";

import type { TodoOwnerTimezonePort } from "../../application/ports/todo-owner-timezone.port.js";

@Injectable()
export class TodoOwnerTimezoneAdapter implements TodoOwnerTimezonePort {
  readonly #userTimezoneReader: UserTimezoneReaderPort;

  constructor(@Inject(USER_TIMEZONE_READER) userTimezoneReader: UserTimezoneReaderPort) {
    this.#userTimezoneReader = userTimezoneReader;
  }

  findTimezone(userId: string): Promise<string | null> {
    return this.#userTimezoneReader.findStoredTimezone(userId);
  }
}
