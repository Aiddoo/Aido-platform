import { EntityId } from "#api/shared/domain/model/entity-id";

export class FriendshipId extends EntityId<string> {
  static reconstitute(value: string): FriendshipId {
    return new FriendshipId(value);
  }
}
