import { Inject, Injectable } from "@nestjs/common";

import { UserTimezoneReaderPort } from "#api/modules/identity/identity-settings.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoOwnerTimezonePort } from "../../application/ports/todo-owner-timezone.port.js";

@Injectable()
export class TodoOwnerTimezoneAdapter implements TodoOwnerTimezonePort {
  readonly #userTimezoneReader: UserTimezoneReaderPort;

  constructor(@Inject(UserTimezoneReaderPort) userTimezoneReader: UserTimezoneReaderPort) {
    this.#userTimezoneReader = userTimezoneReader;
  }

  findTimezone(userId: string): Promise<string | null> {
    return this.#userTimezoneReader.findStoredTimezone(UserId.reconstitute(userId));
  }
}
