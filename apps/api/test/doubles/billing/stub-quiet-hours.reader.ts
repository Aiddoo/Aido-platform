import { QuietHoursReaderPort } from "#api/modules/billing/shared/application/ports/quiet-hours.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class StubQuietHoursReader extends QuietHoursReaderPort {
  readonly #quietUserIds: ReadonlySet<string>;

  constructor(quietUserIds: readonly string[] = []) {
    super();
    this.#quietUserIds = new Set(quietUserIds);
  }

  async findUsersInQuietHours(userIds: readonly UserId[]): Promise<ReadonlySet<string>> {
    return new Set(
      userIds.flatMap((userId) => (this.#quietUserIds.has(userId.value) ? [userId.value] : [])),
    );
  }
}
