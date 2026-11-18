import { EntityId } from "#api/shared/domain/model/entity-id";

export class PushDispatchId extends EntityId<number> {
  static reconstitute(value: number): PushDispatchId {
    return new PushDispatchId(value);
  }
}
