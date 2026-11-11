import { EntityId } from "#api/shared/domain/model/entity-id";

export class FeatureGrantId extends EntityId<string> {
  static reconstitute(value: string): FeatureGrantId {
    return new FeatureGrantId(value);
  }
}
