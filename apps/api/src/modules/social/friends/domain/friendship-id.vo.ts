import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class FriendshipId extends EntityId<string> {
  static generate(): FriendshipId {
    return new FriendshipId(createEntityId());
  }

  static reconstitute(value: string): FriendshipId {
    return new FriendshipId(value);
  }
}
