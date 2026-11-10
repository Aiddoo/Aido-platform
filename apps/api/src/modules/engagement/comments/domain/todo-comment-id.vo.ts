import { EntityId } from "#api/shared/domain/model/entity-id";

export class TodoCommentId extends EntityId<string> {
  static reconstitute(value: string): TodoCommentId {
    return new TodoCommentId(value);
  }
}
