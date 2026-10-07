import type { FollowCachePort } from "../../ports/friends/follow-cache.port.js";
import type { FollowReaderPort } from "../../ports/friends/follow-reader.port.js";
import type { FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";

interface FollowReaderDependencies {
  readonly followRepository: Pick<
    FollowRepositoryPort,
    "isMutualFriend" | "countMutualFriends" | "getUserDisplayName" | "getMutualFriendIds"
  >;
  readonly cache: Pick<
    FollowCachePort,
    "getMutualFriend" | "setMutualFriend" | "wrapFriendCount" | "wrapMutualFriendIds"
  >;
}

export class FollowReader implements FollowReaderPort {
  readonly #dependencies: FollowReaderDependencies;

  constructor(dependencies: FollowReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    const [smallerId, largerId] =
      userId < targetUserId ? [userId, targetUserId] : [targetUserId, userId];

    const cached = await this.#dependencies.cache.getMutualFriend(smallerId, largerId);
    if (cached !== undefined) {
      return cached;
    }

    const isMutual = await this.#dependencies.followRepository.isMutualFriend(userId, targetUserId);
    await this.#dependencies.cache.setMutualFriend(smallerId, largerId, isMutual);
    return isMutual;
  }

  async countFriends(userId: string): Promise<number> {
    return this.#dependencies.cache.wrapFriendCount(userId, () =>
      this.#dependencies.followRepository.countMutualFriends(userId),
    );
  }

  async getUserDisplayName(userId: string): Promise<string> {
    return this.#dependencies.followRepository.getUserDisplayName(userId);
  }

  async getMutualFriendIds(userId: string): Promise<string[]> {
    return this.#dependencies.cache.wrapMutualFriendIds(userId, () =>
      this.#dependencies.followRepository.getMutualFriendIds(userId),
    );
  }

  /** 권한을 판단하는 쓰기 경로는 캐시 대신 현재 친구 관계를 조회한다. */
  getCurrentMutualFriendIds(userId: string): Promise<string[]> {
    return this.#dependencies.followRepository.getMutualFriendIds(userId);
  }
}
