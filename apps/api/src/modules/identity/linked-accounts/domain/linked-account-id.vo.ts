import { EntityId } from "#api/shared/domain/model/entity-id";

export class LinkedAccountId extends EntityId<number> {
  static reconstitute(value: number): LinkedAccountId {
    return new LinkedAccountId(value);
  }
}
