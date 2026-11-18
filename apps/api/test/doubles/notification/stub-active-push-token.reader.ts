import { ActivePushTokenReaderPort } from "#api/modules/notification/push-devices/application/ports/active-push-token.reader.port";
import type { ActivePushTokenReadModel } from "#api/modules/notification/push-devices/application/read-models/active-push-token.read-model";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

type StubToken = string | ActivePushTokenReadModel;

// 토큰 문자열만 주면 앱 버전을 모르는 Expo 토큰이다
function toReadModel(token: StubToken): ActivePushTokenReadModel {
  return typeof token === "string" ? { token, channel: "EXPO", appVersion: null } : token;
}

// cache-aside 활성 토큰 조회 대역. 어떤 사용자를 조회했는지 남겨 capability 경로가 캐시를 거치지 않는지 본다
export class StubActivePushTokenReader extends ActivePushTokenReaderPort {
  readonly #tokensByUser: Map<string, readonly ActivePushTokenReadModel[]>;
  readonly lookedUpUserIds: string[] = [];

  constructor(tokensByUser: Iterable<readonly [string, readonly StubToken[]]> = []) {
    super();
    this.#tokensByUser = new Map(
      [...tokensByUser].map(([userId, tokens]) => [userId, tokens.map(toReadModel)]),
    );
  }

  async findByUserId(user: UserId): Promise<readonly ActivePushTokenReadModel[]> {
    const userId = user.value;
    this.lookedUpUserIds.push(userId);
    return this.#tokensByUser.get(userId) ?? [];
  }

  async findByUserIds(
    users: readonly UserId[],
  ): Promise<ReadonlyMap<string, readonly ActivePushTokenReadModel[]>> {
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
