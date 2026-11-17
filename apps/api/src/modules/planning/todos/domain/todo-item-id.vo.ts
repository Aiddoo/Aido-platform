import { EntityId } from "#api/shared/domain/model/entity-id";

export class TodoItemId extends EntityId<number> {
  static reconstitute(value: number): TodoItemId {
    return new TodoItemId(value);
  }
}
