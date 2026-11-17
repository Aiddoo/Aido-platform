import { EntityId } from "#api/shared/domain/model/entity-id";

export class OAuthStateId extends EntityId<number> {
  static reconstitute(value: number): OAuthStateId {
    return new OAuthStateId(value);
  }
}
