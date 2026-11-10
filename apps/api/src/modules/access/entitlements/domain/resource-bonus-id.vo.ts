import { EntityId } from "#api/shared/domain/model/entity-id";

export class ResourceBonusId extends EntityId<string> {
  static reconstitute(value: string): ResourceBonusId {
    return new ResourceBonusId(value);
  }
}
