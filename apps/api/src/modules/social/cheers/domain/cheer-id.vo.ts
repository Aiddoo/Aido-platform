import { EntityId } from "#api/shared/domain/model/entity-id";

export class CheerId extends EntityId<number> {
  static reconstitute(value: number): CheerId {
    return new CheerId(value);
  }
}
