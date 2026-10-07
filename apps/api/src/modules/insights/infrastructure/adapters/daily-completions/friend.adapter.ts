import { Inject, Injectable } from "@nestjs/common";

import { FOLLOW_READER, type FollowReaderPort } from "#api/modules/social/social-friends.public";

import type { FriendPort } from "../../../application/ports/daily-completions/friend.port.js";

@Injectable()
export class FriendAdapter implements FriendPort {
  constructor(
    @Inject(FOLLOW_READER)
    private readonly followReader: Pick<FollowReaderPort, "isMutualFriend">,
  ) {}

  isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    return this.followReader.isMutualFriend(userId, targetUserId);
  }
}
