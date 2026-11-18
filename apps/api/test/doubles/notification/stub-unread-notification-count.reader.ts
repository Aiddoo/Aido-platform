import { UnreadNotificationCountReaderPort } from "#api/modules/notification/notifications/application/ports/unread-notification-count.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 정해 둔 안 읽은 수를 주고 한 번에 몇 사람을 물었는지 남긴다
export class StubUnreadNotificationCountReader extends UnreadNotificationCountReaderPort {
  readonly #counts: ReadonlyMap<string, number>;
  readonly requestedUserIds: string[][] = [];

  constructor(counts: Iterable<readonly [string, number]> = []) {
    super();
    this.#counts = new Map(counts);
  }

  async countUnreadByUsers(users: readonly UserId[]): Promise<ReadonlyMap<string, number>> {
    const userIds = users.map((user) => user.value);
    this.requestedUserIds.push(userIds);
    return new Map(
      userIds.flatMap((userId) => {
        const count = this.#counts.get(userId);
        return count == null ? [] : [[userId, count] as const];
      }),
    );
  }
}
