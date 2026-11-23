import { Inject, Injectable } from "@nestjs/common";

import { PushQuietHoursReaderPort } from "#api/modules/notification/push-dispatches/notification-push-dispatches.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { QuietHoursReaderPort } from "../../application/ports/quiet-hours.reader.port.js";

// 야간 판단은 notification Context의 공개 capability다
@Injectable()
export class QuietHoursReaderAdapter implements QuietHoursReaderPort {
  readonly #reader: PushQuietHoursReaderPort;

  constructor(@Inject(PushQuietHoursReaderPort) reader: PushQuietHoursReaderPort) {
    this.#reader = reader;
  }

  listUsersInQuietHours(
    userIds: readonly UserId[],
    at: Temporal.Instant,
  ): Promise<ReadonlySet<string>> {
    return this.#reader.listUsersInQuietHours(userIds, at);
  }
}
