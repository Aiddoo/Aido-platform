import { EntityId } from "#api/shared/domain/model/entity-id";

export class InviteId extends EntityId<string> {
  static reconstitute(value: string): InviteId {
    return new InviteId(value);
  }
}
