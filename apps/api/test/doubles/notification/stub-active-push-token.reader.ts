import { ActivePushTokenReaderPort } from "#api/modules/notification/push/application/ports/active-push-token.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// cache-aside 활성 토큰 조회 대역. 어떤 사용자를 조회했는지 남겨 capability 경로가 캐시를 거치지 않는지 본다
export class StubActivePushTokenReader extends ActivePushTokenReaderPort {
  readonly #tokensByUser: Map<string, readonly string[]>;
  readonly lookedUpUserIds: string[] = [];

  constructor(tokensByUser: Iterable<readonly [string, readonly string[]]> = []) {
    super();
    this.#tokensByUser = new Map(tokensByUser);
  }

  async findByUserId(user: UserId): Promise<readonly string[]> {
    const userId = user.value;
    this.lookedUpUserIds.push(userId);
    return this.#tokensByUser.get(userId) ?? [];
  }

  async findByUserIds(users: readonly UserId[]): Promise<ReadonlyMap<string, readonly string[]>> {
    const userIds = users.map((user) => user.value);
    this.lookedUpUserIds.push(...userIds);
    return new Map(
      userIds.flatMap((userId) => {
        const tokens = this.#tokensByUser.get(userId);
        return tokens == null ? [] : [[userId, tokens] as const];
      }),
    );
  }
}
