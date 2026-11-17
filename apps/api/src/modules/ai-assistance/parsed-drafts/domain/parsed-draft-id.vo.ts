import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class ParsedDraftId extends EntityId<string> {
  static generate(): ParsedDraftId {
    return new ParsedDraftId(createEntityId());
  }
}
