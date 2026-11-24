import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class TodoImportId extends EntityId<string> {
  static generate(): TodoImportId {
    return new TodoImportId(createEntityId());
  }

  static reconstitute(value: string): TodoImportId {
    return new TodoImportId(value);
  }
}
