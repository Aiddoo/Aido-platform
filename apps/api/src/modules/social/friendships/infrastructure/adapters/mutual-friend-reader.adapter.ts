import { Injectable } from "@nestjs/common";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  FriendProfileReaderPort,
  readDisplayName,
} from "../../application/ports/friend-profile.reader.port.js";
import { FriendshipCachePort } from "../../application/ports/friendship-cache.port.js";
import { FriendshipRepositoryPort } from "../../application/ports/friendship.repository.port.js";
import type { MutualFriendReaderPort } from "../../application/ports/mutual-friend.reader.port.js";

@Injectable()
export class MutualFriendReaderAdapter implements MutualFriendReaderPort {
  readonly #friendshipRepository: FriendshipRepositoryPort;
  readonly #profileReader: FriendProfileReaderPort;
  readonly #cache: FriendshipCachePort;

  constructor(
    friendshipRepository: FriendshipRepositoryPort,
    profileReader: FriendProfileReaderPort,
    cache: FriendshipCachePort,
  ) {
    this.#friendshipRepository = friendshipRepository;
    this.#profileReader = profileReader;
    this.#cache = cache;
  }

  async isMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean> {
    const [smallerId, largerId] =
      userId.value < targetUserId.value ? [userId, targetUserId] : [targetUserId, userId];
    const cached = await this.#cache.findMutualFriend(smallerId, largerId);
    if (cached != null) {
      return cached;
    }

    const isMutual = await this.isCurrentMutualFriend(userId, targetUserId);
    await this.#cache.setMutualFriend(smallerId, largerId, isMutual);
    return isMutual;
  }

  isCurrentMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean> {
    return this.#friendshipRepository.existsMutualFriendship(userId, targetUserId);
  }

  countFriends(userId: UserId): Promise<number> {
    return this.#cache.wrapFriendCount(userId, () => this.countCurrentFriends(userId));
  }

  // 권한 현황이 한도 검사와 같은 값을 보이도록 캐시 대신 지금 친구 수를 센다
  countCurrentFriends(userId: UserId): Promise<number> {
    return this.#friendshipRepository.countMutualFriends(userId);
  }

  // 캐시 값은 문자열 목록이다(운영 keyspace 모양)
  async getMutualFriendIds(userId: UserId): Promise<UserId[]> {
    const friendIds = await this.#cache.wrapMutualFriendIds(userId, async () => {
      const currentFriendIds = await this.getCurrentMutualFriendIds(userId);
      return currentFriendIds.map((friendId) => friendId.value);
    });
    return friendIds.map((friendId) => UserId.reconstitute(friendId));
  }

  getCurrentMutualFriendIds(userId: UserId): Promise<UserId[]> {
    return this.#friendshipRepository.listMutualFriendIds(userId);
  }

  getUserDisplayName(userId: UserId): Promise<string> {
    return readDisplayName(this.#profileReader, userId);
  }
}
