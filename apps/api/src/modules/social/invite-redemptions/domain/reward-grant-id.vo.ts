import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class RewardGrantId extends EntityId<string> {
  static generate(): RewardGrantId {
    return new RewardGrantId(createEntityId());
  }

  static reconstitute(value: string): RewardGrantId {
    return new RewardGrantId(value);
  }
}
