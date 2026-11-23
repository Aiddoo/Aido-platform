import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class InviteId extends EntityId<string> {
  static generate(): InviteId {
    return new InviteId(createEntityId());
  }

  static reconstitute(value: string): InviteId {
    return new InviteId(value);
  }
}
