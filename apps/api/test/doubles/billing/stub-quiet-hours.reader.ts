import { QuietHoursReaderPort } from "#api/modules/billing/shared/application/ports/quiet-hours.reader.port";

export class StubQuietHoursReader extends QuietHoursReaderPort {
  readonly #quietUserIds: ReadonlySet<string>;

  constructor(quietUserIds: readonly string[] = []) {
    super();
    this.#quietUserIds = new Set(quietUserIds);
  }

  async findUsersInQuietHours(userIds: readonly string[]): Promise<ReadonlySet<string>> {
    return new Set(userIds.filter((userId) => this.#quietUserIds.has(userId)));
  }
}
