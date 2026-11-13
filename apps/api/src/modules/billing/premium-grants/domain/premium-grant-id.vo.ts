import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class PremiumGrantId extends EntityId<string> {
  static generate(): PremiumGrantId {
    return new PremiumGrantId(createEntityId());
  }

  static reconstitute(value: string): PremiumGrantId {
    return new PremiumGrantId(value);
  }
}
