import { EntityId } from "#api/shared/domain/model/entity-id";

export class SubscriptionId extends EntityId<number> {
  static reconstitute(value: number): SubscriptionId {
    return new SubscriptionId(value);
  }
}
