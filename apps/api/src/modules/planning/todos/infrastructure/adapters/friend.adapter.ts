import { Inject, Injectable } from "@nestjs/common";

import { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FriendPort } from "../../application/ports/friend.port.js";

@Injectable()
export class FriendAdapter implements FriendPort {
  readonly #followReader: Pick<
    FollowReaderPort,
    "isMutualFriend" | "getMutualFriendIds" | "getUserDisplayName"
  >;

  constructor(
    @Inject(FollowReaderPort)
    followReader: Pick<
      FollowReaderPort,
      "isMutualFriend" | "getMutualFriendIds" | "getUserDisplayName"
    >,
  ) {
    this.#followReader = followReader;
  }

  isMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean> {
    return this.#followReader.isMutualFriend(userId, targetUserId);
  }

  getMutualFriendIds(userId: UserId): Promise<string[]> {
    return this.#followReader.getMutualFriendIds(userId);
  }

  getUserDisplayName(userId: UserId): Promise<string> {
    return this.#followReader.getUserDisplayName(userId);
  }
}
