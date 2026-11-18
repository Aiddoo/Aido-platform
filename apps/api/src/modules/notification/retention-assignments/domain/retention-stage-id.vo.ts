import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class RetentionStageId extends EntityId<string> {
  static generate(): RetentionStageId {
    return new RetentionStageId(createEntityId());
  }

  static reconstitute(value: string): RetentionStageId {
    return new RetentionStageId(value);
  }
}
