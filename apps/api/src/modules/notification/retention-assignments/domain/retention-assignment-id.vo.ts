import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class RetentionAssignmentId extends EntityId<string> {
  static generate(): RetentionAssignmentId {
    return new RetentionAssignmentId(createEntityId());
  }

  static reconstitute(value: string): RetentionAssignmentId {
    return new RetentionAssignmentId(value);
  }
}
