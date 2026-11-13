import { Injectable } from "@nestjs/common";

import { MutualFriendReaderPort } from "#api/modules/social/friends/social-friends.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendshipReaderPort } from "../../application/ports/friendship.reader.port.js";

// 맞팔은 social이 소유해 social 조회 포트(캐시를 거치는 읽기)로 묻는다
@Injectable()
export class FriendshipReaderAdapter extends FriendshipReaderPort {
  readonly #followReader: Pick<MutualFriendReaderPort, "isMutualFriend">;

  constructor(followReader: MutualFriendReaderPort) {
    super();
    this.#followReader = followReader;
  }

  isMutualFriend(userId: UserId, friendUserId: UserId): Promise<boolean> {
    return this.#followReader.isMutualFriend(userId, friendUserId);
  }
}
