import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FriendshipSeverancePort } from "../../application/ports/friendship-severance.port.js";
import { SeverFriendshipUseCase } from "../../application/use-cases/sever-friendship.use-case.js";

@Injectable()
export class FriendshipSeveranceAdapter implements FriendshipSeverancePort {
  readonly #severFriendship: SeverFriendshipUseCase;

  constructor(severFriendship: SeverFriendshipUseCase) {
    this.#severFriendship = severFriendship;
  }

  severBetween(userId: UserId, otherUserId: UserId): Promise<number> {
    return this.#severFriendship.execute({ userId: userId.value, otherUserId: otherUserId.value });
  }
}
