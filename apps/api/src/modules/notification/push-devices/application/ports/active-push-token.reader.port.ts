import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ActivePushTokenReadModel } from "../read-models/active-push-token.read-model.js";

// 활성 토큰의 cache-aside 조회를 푸시 전달 흐름에 제공한다
export abstract class ActivePushTokenReaderPort {
  abstract findByUserId(userId: UserId): Promise<readonly ActivePushTokenReadModel[]>;
  abstract findByUserIds(
    userIds: readonly UserId[],
  ): Promise<ReadonlyMap<string, readonly ActivePushTokenReadModel[]>>;
}
