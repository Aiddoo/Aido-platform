import { Inject, Injectable } from "@nestjs/common";

import { PushQuietHoursReaderPort } from "#api/modules/notification/notification-delivery.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import { QuietHoursReaderPort } from "../../application/ports/quiet-hours.reader.port.js";

// 야간 판단은 notification Context의 공개 capability다. 시각 형식만 맞춰 넘긴다
@Injectable()
export class QuietHoursReaderAdapter extends QuietHoursReaderPort {
  readonly #reader: PushQuietHoursReaderPort;

  constructor(@Inject(PushQuietHoursReaderPort) reader: PushQuietHoursReaderPort) {
    super();
    this.#reader = reader;
  }

  findUsersInQuietHours(
    userIds: readonly string[],
    at: Temporal.Instant,
  ): Promise<ReadonlySet<string>> {
    return this.#reader.findUsersInQuietHours(
      userIds.map((userId) => UserId.reconstitute(userId)),
      instantToDate(at),
    );
  }
}
