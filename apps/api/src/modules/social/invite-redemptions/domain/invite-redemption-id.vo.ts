import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class InviteRedemptionId extends EntityId<string> {
  static generate(): InviteRedemptionId {
    return new InviteRedemptionId(createEntityId());
  }

  static reconstitute(value: string): InviteRedemptionId {
    return new InviteRedemptionId(value);
  }
}
