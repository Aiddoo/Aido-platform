import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 활성 토큰의 cache-aside 조회를 푸시 전달 흐름에 제공한다
export abstract class ActivePushTokenReaderPort {
  abstract findByUserId(userId: UserId): Promise<readonly string[]>;
  abstract findByUserIds(
    userIds: readonly UserId[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
