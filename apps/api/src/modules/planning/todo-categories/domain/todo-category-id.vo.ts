import { EntityId } from "#api/shared/domain/model/entity-id";

export class TodoCategoryId extends EntityId<number> {
  static reconstitute(value: number): TodoCategoryId {
    return new TodoCategoryId(value);
  }
}
