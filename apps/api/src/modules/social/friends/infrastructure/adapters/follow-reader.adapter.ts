import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FollowCachePort } from "../../application/ports/follow-cache.port.js";
import type { FollowReaderPort } from "../../application/ports/follow.reader.port.js";
import { FollowRepositoryPort } from "../../application/ports/follow.repository.port.js";
import type { FriendCountReaderPort } from "../../application/ports/friend-count.reader.port.js";
import { FriendProfileReaderPort } from "../../application/ports/friend-profile.reader.port.js";

// 다른 Context가 보는 친구 판정이다. current 메서드는 권한을 판단하는 쓰기 경로라 캐시를 거치지 않는다
@Injectable()
export class FollowReaderAdapter implements FollowReaderPort, FriendCountReaderPort {
  readonly #followRepository: FollowRepositoryPort;
  readonly #profileReader: FriendProfileReaderPort;
  readonly #cache: FollowCachePort;

  constructor(
    followRepository: FollowRepositoryPort,
    profileReader: FriendProfileReaderPort,
    cache: FollowCachePort,
  ) {
    this.#followRepository = followRepository;
    this.#profileReader = profileReader;
    this.#cache = cache;
  }

  async isMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean> {
    const [smallerId, largerId] =
      userId.value < targetUserId.value ? [userId, targetUserId] : [targetUserId, userId];
    const cached = await this.#cache.getMutualFriend(smallerId, largerId);
    if (cached != null) {
      return cached;
    }

    const isMutual = await this.isCurrentMutualFriend(userId, targetUserId);
    await this.#cache.setMutualFriend(smallerId, largerId, isMutual);
    return isMutual;
  }

  isCurrentMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean> {
    return this.#followRepository.existsMutualFriendship(userId, targetUserId);
  }

  countFriends(userId: UserId): Promise<number> {
    return this.#cache.wrapFriendCount(userId, () => this.countCurrentFriends(userId));
  }

  // 권한 스냅샷이 한도 검사와 같은 값을 보이도록 캐시 대신 지금 친구 수를 센다
  countCurrentFriends(userId: UserId): Promise<number> {
    return this.#followRepository.countMutualFriends(userId);
  }

  getMutualFriendIds(userId: UserId): Promise<string[]> {
    return this.#cache.wrapMutualFriendIds(userId, () => this.getCurrentMutualFriendIds(userId));
  }

  async getCurrentMutualFriendIds(userId: UserId): Promise<string[]> {
    const friendIds = await this.#followRepository.listMutualFriendIds(userId);
    return friendIds.map((friendId) => friendId.value);
  }

  async getUserDisplayName(userId: UserId): Promise<string> {
    return (await this.#profileReader.findDisplayName(userId)) ?? userId.value;
  }
}
