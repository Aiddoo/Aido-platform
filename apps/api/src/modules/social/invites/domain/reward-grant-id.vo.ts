import { EntityId } from "#api/shared/domain/model/entity-id";

export class RewardGrantId extends EntityId<string> {
  static reconstitute(value: string): RewardGrantId {
    return new RewardGrantId(value);
  }
}
