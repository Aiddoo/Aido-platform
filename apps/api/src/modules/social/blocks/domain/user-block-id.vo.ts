import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class UserBlockId extends EntityId<string> {
  static generate(): UserBlockId {
    return new UserBlockId(createEntityId());
  }

  static reconstitute(value: string): UserBlockId {
    return new UserBlockId(value);
  }
}
