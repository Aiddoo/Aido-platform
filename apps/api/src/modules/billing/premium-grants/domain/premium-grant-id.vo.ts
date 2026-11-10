import { EntityId } from "#api/shared/domain/model/entity-id";

export class PremiumGrantId extends EntityId<string> {
  static reconstitute(value: string): PremiumGrantId {
    return new PremiumGrantId(value);
  }
}
