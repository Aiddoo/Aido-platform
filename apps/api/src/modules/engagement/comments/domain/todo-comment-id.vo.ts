import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class TodoCommentId extends EntityId<string> {
  static generate(): TodoCommentId {
    return new TodoCommentId(createEntityId());
  }

  static reconstitute(value: string): TodoCommentId {
    return new TodoCommentId(value);
  }
}
