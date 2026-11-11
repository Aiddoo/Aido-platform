import { Injectable } from "@nestjs/common";

import type {
  EstablishFriendshipInput,
  FriendshipEstablisherPort,
  FriendshipEstablishment,
} from "../../application/ports/friendship-establisher.port.js";
import { EstablishFriendshipUseCase } from "../../application/use-cases/establish-friendship.use-case.js";

@Injectable()
export class FriendshipEstablisherAdapter implements FriendshipEstablisherPort {
  readonly #establishFriendship: EstablishFriendshipUseCase;

  constructor(establishFriendship: EstablishFriendshipUseCase) {
    this.#establishFriendship = establishFriendship;
  }

  establish(input: EstablishFriendshipInput): Promise<FriendshipEstablishment> {
    return this.#establishFriendship.execute({
      requesterId: input.requesterId.value,
      targetUserId: input.targetUserId.value,
      shouldNotifyFriends: input.shouldNotifyFriends,
    });
  }
}
