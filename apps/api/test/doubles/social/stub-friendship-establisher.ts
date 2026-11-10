import type { EstablishFriendshipInput } from "#api/modules/social/friends/application/ports/friendship-establisher.port";
import {
  FriendshipEstablisherPort,
  type FriendshipEstablishment,
} from "#api/modules/social/friends/social-friends.public";

// 정해 둔 결과를 돌려주고 요청을 남긴다
export class StubFriendshipEstablisher extends FriendshipEstablisherPort {
  readonly requests: EstablishFriendshipInput[] = [];
  result: FriendshipEstablishment = "FRIENDS";

  async establish(input: EstablishFriendshipInput): Promise<FriendshipEstablishment> {
    this.requests.push(input);
    return this.result;
  }
}
