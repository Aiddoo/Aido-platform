import { EntityId } from "#api/shared/domain/model/entity-id";

export class SuggestionId extends EntityId<number> {
  static reconstitute(value: number): SuggestionId {
    return new SuggestionId(value);
  }
}
