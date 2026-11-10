import { Inject, Injectable } from "@nestjs/common";

import { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

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

  isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    return this.#followReader.isMutualFriend(
      UserId.reconstitute(userId),
      UserId.reconstitute(targetUserId),
    );
  }

  getMutualFriendIds(userId: string): Promise<string[]> {
    return this.#followReader.getMutualFriendIds(UserId.reconstitute(userId));
  }

  getUserDisplayName(userId: string): Promise<string> {
    return this.#followReader.getUserDisplayName(UserId.reconstitute(userId));
  }
}
