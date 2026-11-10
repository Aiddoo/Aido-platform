import { EntityId } from "#api/shared/domain/model/entity-id";

export class InviteRedemptionId extends EntityId<string> {
  static reconstitute(value: string): InviteRedemptionId {
    return new InviteRedemptionId(value);
  }
}
