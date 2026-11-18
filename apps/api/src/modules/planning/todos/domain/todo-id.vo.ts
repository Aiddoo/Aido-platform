import { EntityId } from "#api/shared/domain/model/entity-id";

export class TodoId extends EntityId<number> {
  static reconstitute(value: number): TodoId {
    return new TodoId(value);
  }
}
