import {
  type FriendFeatureQuota,
  FriendLimitReaderPort,
} from "#api/modules/social/friends/application/ports/friend-limit.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 사용자별 친구 한도를 정해 두고(기본 무제한), featureQuota는 받은 친구 수를 그대로 실어 돌려준다
export class StubFriendLimitReader extends FriendLimitReaderPort {
  readonly #maxFriendCounts = new Map<string, number | null>();

  setMaxFriendCount(userId: string, maxFriendCount: number | null): void {
    this.#maxFriendCounts.set(userId, maxFriendCount);
  }

  async readLimit(userId: UserId): Promise<number | null> {
    return this.#maxFriendCounts.get(userId.value) ?? null;
  }

  async readLimitInTx(userId: UserId): Promise<number | null> {
    return this.#maxFriendCounts.get(userId.value) ?? null;
  }

  async readFeatureQuotaInTx(userId: UserId, friendCount: number): Promise<FriendFeatureQuota> {
    return {
      feature: "FRIEND",
      userId: userId.value,
      limit: this.#maxFriendCounts.get(userId.value) ?? null,
      used: friendCount,
    };
  }
}
