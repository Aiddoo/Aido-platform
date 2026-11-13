import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class FeatureGrantId extends EntityId<string> {
  static generate(): FeatureGrantId {
    return new FeatureGrantId(createEntityId());
  }

  static reconstitute(value: string): FeatureGrantId {
    return new FeatureGrantId(value);
  }
}
