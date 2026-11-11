import { EntityId } from "#api/shared/domain/model/entity-id";

export class NudgeId extends EntityId<number> {
  static reconstitute(value: number): NudgeId {
    return new NudgeId(value);
  }
}
